const DEFAULT_API = "http://localhost:4000";

export async function getSettings(): Promise<{
  apiBase: string;
  token: string | null;
}> {
  const data = await chrome.storage.sync.get(["apiBase", "token"]);
  return {
    apiBase: (data.apiBase as string) || DEFAULT_API,
    token: (data.token as string) || null,
  };
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { apiBase, token } = await getSettings();
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `API ${res.status}`);
  }
  return body as T;
}
