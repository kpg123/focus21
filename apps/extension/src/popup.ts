import { apiFetch, getSettings } from "./api";

const signedOut = document.getElementById("signedOut")!;
const signedIn = document.getElementById("signedIn")!;
const balanceEl = document.getElementById("balance")!;
const greetingEl = document.getElementById("greeting")!;
const emailInput = document.getElementById("email") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const apiInput = document.getElementById("apiBase") as HTMLInputElement;
const loginBtn = document.getElementById("login") as HTMLButtonElement;
const logoutBtn = document.getElementById("logout") as HTMLButtonElement;
const matchBtn = document.getElementById("match") as HTMLButtonElement;
const authError = document.getElementById("authError")!;
const matchNote = document.getElementById("matchNote")!;
const nowTitle = document.getElementById("nowTitle")!;
const nowMeta = document.getElementById("nowMeta")!;
const nowState = document.getElementById("nowState")!;
const todayMinutes = document.getElementById("todayMinutes")!;
const sessionSeconds = document.getElementById("sessionSeconds")!;

function showAuthError(message: string | null) {
  if (!message) {
    authError.hidden = true;
    authError.textContent = "";
    return;
  }
  authError.hidden = false;
  authError.textContent = message;
}

function setNowTracking(active: {
  playing: boolean;
  context: {
    channelName: string;
    videoTitle?: string;
    platform: string;
  };
  secondsSent: number;
} | null) {
  if (!active) {
    nowTitle.textContent = "Nothing playing";
    nowMeta.textContent = "Play a video on YouTube, Twitch, or Kick.";
    nowState.textContent = "Idle";
    nowState.className = "pill idle";
    sessionSeconds.textContent = "0s";
    return;
  }

  nowTitle.textContent =
    active.context.videoTitle || active.context.channelName || "Watching";
  nowMeta.textContent = `${active.context.channelName} · ${active.context.platform}`;
  sessionSeconds.textContent = `${active.secondsSent}s`;

  if (active.playing) {
    nowState.textContent = "Playing";
    nowState.className = "pill live";
  } else {
    nowState.textContent = "Paused";
    nowState.className = "pill paused";
  }
}

async function refreshActiveWatch() {
  const response = await chrome.runtime.sendMessage({ type: "GET_ACTIVE_WATCH" });
  setNowTracking(response?.activeWatch ?? null);
}

async function refresh() {
  const settings = await getSettings();
  apiInput.value = settings.apiBase;
  showAuthError(null);
  matchNote.hidden = true;

  if (!settings.token) {
    signedOut.hidden = false;
    signedIn.hidden = true;
    balanceEl.hidden = true;
    return;
  }

  try {
    const me = await apiFetch<{
      user: { displayName: string; balanceCents: number; email: string };
    }>("/auth/me");
    const stats = await apiFetch<{
      totalMinutes: number;
      channels: Array<{ name: string; minutes: number }>;
    }>("/watch/stats");

    signedOut.hidden = true;
    signedIn.hidden = false;
    balanceEl.hidden = false;
    balanceEl.textContent = `$${(me.user.balanceCents / 100).toFixed(2)}`;
    greetingEl.textContent = me.user.displayName;
    todayMinutes.textContent = `${stats.totalMinutes}m`;
    await refreshActiveWatch();
  } catch (err) {
    signedOut.hidden = false;
    signedIn.hidden = true;
    balanceEl.hidden = true;
    showAuthError(err instanceof Error ? err.message : "Session expired");
  }
}

loginBtn.addEventListener("click", async () => {
  loginBtn.disabled = true;
  showAuthError(null);
  try {
    const apiBase = apiInput.value.replace(/\/$/, "") || "http://localhost:4000";
    await chrome.storage.sync.set({ apiBase });

    const res = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError(data.error || "Login failed");
      return;
    }
    await chrome.storage.sync.set({ token: data.token, apiBase });
    await refresh();
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.sync.remove(["token"]);
  await refresh();
});

matchBtn.addEventListener("click", async () => {
  matchBtn.disabled = true;
  matchNote.hidden = false;
  matchNote.textContent = "Checking…";
  try {
    const data = await apiFetch<{
      offers: Array<{ title: string; rewardCents: number }>;
    }>("/surveys/match", { method: "POST", body: "{}" });
    if (!data.offers.length) {
      matchNote.textContent = "No matching surveys right now.";
      return;
    }
    const first = data.offers[0];
    matchNote.textContent = `Matched: ${first.title} ($${(
      first.rewardCents / 100
    ).toFixed(2)})`;
    chrome.runtime.sendMessage({ type: "POLL_OFFERS" });
  } catch (err) {
    matchNote.textContent = err instanceof Error ? err.message : "Match failed";
  } finally {
    matchBtn.disabled = false;
  }
});

void refresh();
setInterval(() => {
  if (!signedIn.hidden) void refreshActiveWatch();
}, 2000);
