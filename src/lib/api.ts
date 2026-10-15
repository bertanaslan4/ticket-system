import { getLanguage, errorSource } from "../i18n/index.js";
export async function api<T = any>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    signal,
    headers: {
      "Accept-Language": getLanguage(),
      ...(body !== undefined && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(body !== undefined
      ? {
          method: "POST",
          body: body instanceof FormData ? body : JSON.stringify(body),
        }
      : {}),
  }).catch((error) => {
    if (error.name === "AbortError") throw error;
    throw new Error("unable_to_connect_please_try_again");
  });
  const data = await response.json();
  if (!response.ok) {
    const error = Object.assign(errorSource(data), { status: response.status });
    if (response.status === 401 && path !== "/login" && path !== "/me")
      window.dispatchEvent(new Event("session-expired"));
    throw error;
  }
  return data;
}
