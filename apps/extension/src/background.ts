import { apiFetch, getSettings } from "./api";

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

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("focus21-match", { periodInMinutes: 2 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "focus21-match") {
    void matchAndNotify();
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

    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: "SHOW_OFFER", offer }).catch(() => {
          /* content script may not be on this tab */
        });
      }
    }
  } catch {
    // offline / unauthenticated
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "WATCH_HEARTBEAT") {
    void (async () => {
      try {
        await apiFetch("/watch/heartbeat", {
          method: "POST",
          body: JSON.stringify(message.payload),
        });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "heartbeat failed",
        });
      }
    })();
    return true;
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
