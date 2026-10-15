import { isMediaPlaying, findMediaElement } from "./media";
import { extractWatchContext, type WatchContext } from "./platforms";

const OFFER_POLL_MS = 60_000;
const CONTEXT_POLL_MS = 2_000;

let overlayRoot: HTMLDivElement | null = null;
let attachedMedia: HTMLVideoElement | null = null;
let lastReportedPlaying: boolean | null = null;
let lastMediaKey = "";
let listenersBound = false;

function mediaKey(ctx: WatchContext): string {
  return `${ctx.platform}:${ctx.channelId}:${ctx.videoId ?? ctx.url}`;
}

function reportPlayback(playing: boolean, reason: string) {
  const ctx = extractWatchContext();
  if (!ctx) {
    if (lastReportedPlaying !== false) {
      lastReportedPlaying = false;
      chrome.runtime.sendMessage({
        type: "PLAYBACK_STATE",
        playing: false,
        reason,
      });
    }
    return;
  }

  const key = mediaKey(ctx);
  // Only claim "playing" when media is actually playing; paused never accrues.
  const actuallyPlaying = playing && isMediaPlaying();
  if (
    actuallyPlaying === lastReportedPlaying &&
    key === lastMediaKey &&
    reason !== "force"
  ) {
    return;
  }

  lastReportedPlaying = actuallyPlaying;
  lastMediaKey = key;

  chrome.runtime.sendMessage({
    type: "PLAYBACK_STATE",
    playing: actuallyPlaying,
    reason,
    context: ctx,
  });
}

function onPlay() {
  reportPlayback(true, "play");
}

function onPause() {
  reportPlayback(false, "pause");
}

function onEnded() {
  reportPlayback(false, "ended");
}

function detachMedia() {
  if (!attachedMedia) return;
  attachedMedia.removeEventListener("play", onPlay);
  attachedMedia.removeEventListener("playing", onPlay);
  attachedMedia.removeEventListener("pause", onPause);
  attachedMedia.removeEventListener("ended", onEnded);
  attachedMedia = null;
}

function attachMedia() {
  const media = findMediaElement();
  if (media === attachedMedia) {
    // Still sync state in case we missed an event (SPA / autoplay).
    reportPlayback(isMediaPlaying(media), "poll");
    return;
  }

  detachMedia();
  attachedMedia = media;
  if (!media) {
    reportPlayback(false, "no-media");
    return;
  }

  media.addEventListener("play", onPlay);
  media.addEventListener("playing", onPlay);
  media.addEventListener("pause", onPause);
  media.addEventListener("ended", onEnded);
  reportPlayback(isMediaPlaying(media), "attach");
}

function ensureOverlay(): HTMLDivElement {
  if (overlayRoot) return overlayRoot;
  overlayRoot = document.createElement("div");
  overlayRoot.id = "focus21-overlay-root";
  document.documentElement.appendChild(overlayRoot);
  return overlayRoot;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showOfferPopup(offer: {
  id: string;
  surveyId: string;
  title: string;
  description: string;
  rewardCents: number;
  estimatedMinutes: number;
  channelName: string;
}) {
  const root = ensureOverlay();
  root.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "focus21-offer";
  panel.innerHTML = `
    <div class="focus21-offer__brand">Focus21</div>
    <div class="focus21-offer__title">${escapeHtml(offer.title)}</div>
    <div class="focus21-offer__meta">${escapeHtml(offer.channelName)} · $${(
      offer.rewardCents / 100
    ).toFixed(2)} · ~${offer.estimatedMinutes} min</div>
    <p class="focus21-offer__desc">${escapeHtml(offer.description)}</p>
    <div class="focus21-offer__actions">
      <button type="button" data-action="take">Take survey</button>
      <button type="button" data-action="dismiss" class="ghost">Not now</button>
    </div>
  `;

  panel.querySelector('[data-action="take"]')?.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "OPEN_SURVEY",
      surveyId: offer.surveyId,
      offerId: offer.id,
    });
    root.innerHTML = "";
  });

  panel.querySelector('[data-action="dismiss"]')?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "DISMISS_OFFER", offerId: offer.id });
    root.innerHTML = "";
  });

  root.appendChild(panel);
  chrome.runtime.sendMessage({ type: "SEEN_OFFER", offerId: offer.id });
}

function showTrackingChip(state: {
  tracking: boolean;
  playing: boolean;
  title?: string;
}) {
  const root = ensureOverlay();
  let chip = root.querySelector<HTMLDivElement>(".focus21-chip");
  if (!state.tracking) {
    chip?.remove();
    return;
  }
  if (!chip) {
    chip = document.createElement("div");
    chip.className = "focus21-chip";
    root.appendChild(chip);
  }
  const label = state.playing ? "Tracking" : "Paused";
  const title = state.title ? ` · ${state.title}` : "";
  chip.dataset.state = state.playing ? "live" : "paused";
  chip.textContent = `Focus21 ${label}${title}`;
}

function pollOffers() {
  chrome.runtime.sendMessage({ type: "POLL_OFFERS" }, (response) => {
    if (chrome.runtime.lastError) return;
    const offer = response?.offer;
    if (offer) showOfferPopup(offer);
  });
}

function bindSpaHooks() {
  if (listenersBound) return;
  listenersBound = true;

  window.addEventListener("yt-navigate-finish", () => attachMedia());
  document.addEventListener("visibilitychange", () => {
    // Tab switches must not stop tracking — only pause/play does.
    attachMedia();
  });

  const observer = new MutationObserver(() => attachMedia());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SHOW_OFFER" && message.offer) {
    showOfferPopup(message.offer);
    return false;
  }

  if (message?.type === "VERIFY_PLAYING") {
    const ctx = extractWatchContext();
    const playing = isMediaPlaying();
    sendResponse({
      playing,
      context: ctx,
      mediaKey: ctx ? mediaKey(ctx) : null,
    });
    return false;
  }

  if (message?.type === "TRACKING_STATUS") {
    showTrackingChip(message);
    return false;
  }

  return false;
});

bindSpaHooks();
attachMedia();
setInterval(attachMedia, CONTEXT_POLL_MS);
setInterval(pollOffers, OFFER_POLL_MS);
setTimeout(pollOffers, 4000);
