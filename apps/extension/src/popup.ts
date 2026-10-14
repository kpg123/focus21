import { apiFetch, getSettings } from "./api";

const statusEl = document.getElementById("status")!;
const emailInput = document.getElementById("email") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const apiInput = document.getElementById("apiBase") as HTMLInputElement;
const loginBtn = document.getElementById("login") as HTMLButtonElement;
const logoutBtn = document.getElementById("logout") as HTMLButtonElement;
const matchBtn = document.getElementById("match") as HTMLButtonElement;
const statsEl = document.getElementById("stats")!;

async function refresh() {
  const settings = await getSettings();
  apiInput.value = settings.apiBase;

  if (!settings.token) {
    statusEl.textContent = "Signed out";
    statsEl.textContent = "Sign in to sync watch time and survey offers.";
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    matchBtn.hidden = true;
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

    statusEl.textContent = `${me.user.displayName} · $${(
      me.user.balanceCents / 100
    ).toFixed(2)}`;
    const top = stats.channels
      .slice(0, 3)
      .map((c) => `${c.name} (${c.minutes}m)`)
      .join(" · ");
    statsEl.textContent = `Today: ${stats.totalMinutes} min${top ? ` — ${top}` : ""}`;
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    matchBtn.hidden = false;
  } catch (err) {
    statusEl.textContent = "Session expired";
    statsEl.textContent = err instanceof Error ? err.message : "Auth error";
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    matchBtn.hidden = true;
  }
}

loginBtn.addEventListener("click", async () => {
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
    statusEl.textContent = data.error || "Login failed";
    return;
  }
  await chrome.storage.sync.set({ token: data.token, apiBase });
  await refresh();
});

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.sync.remove(["token"]);
  await refresh();
});

matchBtn.addEventListener("click", async () => {
  try {
    const data = await apiFetch<{ offers: Array<{ title: string; rewardCents: number }> }>(
      "/surveys/match",
      { method: "POST", body: "{}" },
    );
    if (!data.offers.length) {
      statsEl.textContent = "No matching surveys right now.";
      return;
    }
    const first = data.offers[0];
    statsEl.textContent = `Matched: ${first.title} ($${(first.rewardCents / 100).toFixed(2)})`;
    chrome.runtime.sendMessage({ type: "POLL_OFFERS" });
  } catch (err) {
    statsEl.textContent = err instanceof Error ? err.message : "Match failed";
  }
});

void refresh();
