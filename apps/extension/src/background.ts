import { apiFetch, getSettings } from "./api";
import type { WatchContext } from "./platforms";
import {
  claimPlayback,
  clearIfTab,
  heartbeatSeconds,
  pauseIfActive,
  type ActiveWatch,
} from "./session";

interface Offer {
  id: string;
  surveyId: string;
  title: string;
  description: string;
  rewardCents: number;
  estimatedMinutes: number;
  channelName: string;
  expiresAt: string;
}

const shownOffers = new Set<string>();
let activeWatch: ActiveWatch | null = null;

async function persistActive() {
  await chrome.storage.session.set({
    activeWatch: activeWatch
      ? {
          tabId: activeWatch.tabId,
          clientSessionId: activeWatch.clientSessionId,
          mediaKey: activeWatch.mediaKey,
          context: activeWatch.context,
          playing: activeWatch.playing,
          startedAt: activeWatch.startedAt,
          secondsSent: activeWatch.secondsSent,
        }
      : null,
  });
}

async function notifyTrackingStatus() {
  if (!activeWatch) return;
  try {
    await chrome.tabs.sendMessage(activeWatch.tabId, {
      type: "TRACKING_STATUS",
      tracking: true,
      playing: activeWatch.playing,
      title: activeWatch.context.videoTitle || activeWatch.context.channelName,
    });
  } catch {
    /* tab may not have content script */
  }
}

async function setActive(next: ActiveWatch | null) {
  const prevTab = activeWatch?.tabId;
  activeWatch = next;
  await persistActive();
  await notifyTrackingStatus();

  // Clear chip on the previous tab when ownership moves.
  if (prevTab != null && prevTab !== next?.tabId) {
    try {
      await chrome.tabs.sendMessage(prevTab, {
        type: "TRACKING_STATUS",
        tracking: false,
        playing: false,
      });
    } catch {
      /* ignore */
    }
  }
}

async function flushHeartbeat() {
  if (!activeWatch) return;
  const now = Date.now();
  const seconds = heartbeatSeconds(activeWatch, now);
  if (seconds < 1) return;

  const payload = {
    ...activeWatch.context,
    secondsWatched: seconds,
    startedAt: activeWatch.startedAt,
    clientSessionId: activeWatch.clientSessionId,
    playing: true,
  };

  try {
    await apiFetch("/watch/heartbeat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    activeWatch = {
      ...activeWatch,
      lastHeartbeatAt: now,
      secondsSent: activeWatch.secondsSent + seconds,
    };
    await persistActive();
  } catch {
    // Keep local accrual window; retry next tick.
  }
}

async function verifyActiveStillPlaying() {
  if (!activeWatch) return;
  try {
    const response = await chrome.tabs.sendMessage(activeWatch.tabId, {
      type: "VERIFY_PLAYING",
    });
    if (!response?.playing) {
      await setActive(pauseIfActive(activeWatch, activeWatch.tabId));
      return;
    }
    if (response.context) {
      // Refresh metadata but do not steal session unless media identity changed.
      const ctx = response.context as WatchContext;
      const key = `${ctx.platform}:${ctx.channelId}:${ctx.videoId ?? ctx.url}`;
      if (key === activeWatch.mediaKey) {
        activeWatch = { ...activeWatch, context: ctx, playing: true };
        await persistActive();
      }
    }
  } catch {
    // Tab gone or inaccessible.
    await setActive(null);
  }
}

function scheduleHeartbeatAlarm() {
  // Chain short delays — more reliable than sub-minute periodInMinutes in MV3.
  chrome.alarms.create("focus21-heartbeat", { delayInMinutes: 0.25 });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("focus21-match", { periodInMinutes: 2 });
  scheduleHeartbeatAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "focus21-match") {
    void matchAndNotify();
  }
  if (alarm.name === "focus21-heartbeat") {
    void (async () => {
      await verifyActiveStillPlaying();
      await flushHeartbeat();
      await notifyTrackingStatus();
      scheduleHeartbeatAlarm();
    })();
  }
});

async function matchAndNotify() {
  const { token } = await getSettings();
  if (!token) return;
  try {
    const data = await apiFetch<{ offers: Offer[] }>("/surveys/match", {
      method: "POST",
      body: "{}",
    });
    const offer = data.offers.find((o) => !shownOffers.has(o.id));
    if (!offer) return;
    shownOffers.add(offer.id);

    await chrome.notifications.create(`offer-${offer.id}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Focus21 survey available",
      message: `${offer.title} · $${(offer.rewardCents / 100).toFixed(2)} from ${offer.channelName}`,
      priority: 2,
    });

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: "SHOW_OFFER", offer }).catch(() => undefined);
      }
    }
  } catch {
    // offline / unauthenticated
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  void setActive(clearIfTab(activeWatch, tabId));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PLAYBACK_STATE") {
    void (async () => {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        sendResponse({ ok: false });
        return;
      }

      if (message.playing && message.context) {
        // Last play wins — only one video accrues time across all tabs.
        const next = claimPlayback(activeWatch, tabId, message.context as WatchContext);
        await setActive(next);
        await flushHeartbeat();
        sendResponse({
          ok: true,
          active: true,
          clientSessionId: next.clientSessionId,
        });
        return;
      }

      // Pause / end: stop accrual but keep session ownership until another play.
      if (activeWatch?.tabId === tabId) {
        await flushHeartbeat();
        await setActive(pauseIfActive(activeWatch, tabId));
      }
      sendResponse({ ok: true, active: activeWatch?.tabId === tabId });
    })();
    return true;
  }

  if (message?.type === "GET_ACTIVE_WATCH") {
    sendResponse({
      activeWatch: activeWatch
        ? {
            tabId: activeWatch.tabId,
            clientSessionId: activeWatch.clientSessionId,
            mediaKey: activeWatch.mediaKey,
            context: activeWatch.context,
            playing: activeWatch.playing,
            startedAt: activeWatch.startedAt,
            secondsSent: activeWatch.secondsSent,
          }
        : null,
    });
    return false;
  }

  if (message?.type === "POLL_OFFERS") {
    void (async () => {
      try {
        const data = await apiFetch<{ offers: Offer[] }>("/surveys/offers");
        const offer = data.offers.find((o) => !shownOffers.has(o.id));
        if (offer) {
          shownOffers.add(offer.id);
          sendResponse({ offer });
        } else {
          sendResponse({ offer: null });
        }
      } catch {
        sendResponse({ offer: null });
      }
    })();
    return true;
  }

  if (message?.type === "SEEN_OFFER") {
    void apiFetch(`/surveys/offers/${message.offerId}/seen`, {
      method: "POST",
      body: "{}",
    }).catch(() => undefined);
    return false;
  }

  if (message?.type === "DISMISS_OFFER") {
    void apiFetch(`/surveys/offers/${message.offerId}/dismiss`, {
      method: "POST",
      body: "{}",
    }).catch(() => undefined);
    return false;
  }

  if (message?.type === "OPEN_SURVEY") {
    const webBase = "http://localhost:5173";
    void chrome.tabs.create({
      url: `${webBase}/surveys/${message.surveyId}`,
    });
    if (message.offerId) {
      void apiFetch(`/surveys/offers/${message.offerId}/seen`, {
        method: "POST",
        body: "{}",
      }).catch(() => undefined);
    }
    return false;
  }

  return false;
});

// Ensure alarms exist after service worker restarts.
chrome.alarms.get("focus21-heartbeat", (alarm) => {
  if (!alarm) scheduleHeartbeatAlarm();
});
chrome.alarms.get("focus21-match", (alarm) => {
  if (!alarm) {
    chrome.alarms.create("focus21-match", { periodInMinutes: 2 });
  }
});
