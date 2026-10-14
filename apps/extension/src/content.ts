import { extractWatchContext } from "./platforms";

const HEARTBEAT_MS = 15_000;
const OFFER_POLL_MS = 60_000;

let startedAt = new Date().toISOString();
let lastContextKey = "";
let secondsAccumulated = 0;
let overlayRoot: HTMLDivElement | null = null;

function contextKey(ctx: ReturnType<typeof extractWatchContext>): string {
  if (!ctx) return "";
  return `${ctx.platform}:${ctx.channelId}:${ctx.videoId ?? ""}`;
}

function ensureOverlay(): HTMLDivElement {
  if (overlayRoot) return overlayRoot;
  overlayRoot = document.createElement("div");
  overlayRoot.id = "focus21-overlay-root";
  document.documentElement.appendChild(overlayRoot);
  return overlayRoot;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tickWatch() {
  const ctx = extractWatchContext();
  const key = contextKey(ctx);
  if (!ctx) {
    secondsAccumulated = 0;
    lastContextKey = "";
    return;
  }

  if (key !== lastContextKey) {
    lastContextKey = key;
    startedAt = new Date().toISOString();
    secondsAccumulated = 0;
  }

  secondsAccumulated += HEARTBEAT_MS / 1000;

  if (secondsAccumulated >= 15) {
    const secondsWatched = Math.floor(secondsAccumulated);
    secondsAccumulated = 0;
    chrome.runtime.sendMessage({
      type: "WATCH_HEARTBEAT",
      payload: {
        ...ctx,
        secondsWatched,
        startedAt,
      },
    });
  }
}

function pollOffers() {
  chrome.runtime.sendMessage({ type: "POLL_OFFERS" }, (response) => {
    if (chrome.runtime.lastError) return;
    const offer = response?.offer;
    if (offer) showOfferPopup(offer);
  });
}

setInterval(tickWatch, HEARTBEAT_MS);
setInterval(pollOffers, OFFER_POLL_MS);

// Initial delay so the page can hydrate channel metadata
setTimeout(() => {
  tickWatch();
  pollOffers();
}, 4000);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "SHOW_OFFER" && message.offer) {
    showOfferPopup(message.offer);
  }
});
