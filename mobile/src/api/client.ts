import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "bekatos_session_token";
const API_URL_KEY = "bekatos_api_base_url";
const DEFAULT_API_URL = "http://localhost:3000/api";

export interface MediaAttachment {
  uri: string;
  name: string;
  type: string;
}

export async function getApiBaseUrl(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(API_URL_KEY)) || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const normalized = url.trim().replace(/\/+$/, "");
  await SecureStore.setItemAsync(
    API_URL_KEY,
    normalized.endsWith("/api") ? normalized : `${normalized}/api`,
  );
}

export async function getSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveSessionToken(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Ignore storage errors in web preview
  }
}

export async function mobileRequest<T = any>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: any;
    files?: MediaAttachment[];
  } = {},
): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const token = await getSessionToken();
  const headers: Record<string, string> = {
    "X-Client": "mobile",
    "Accept-Language": "tr",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let fetchBody: any;
  if (options.files && options.files.length > 0) {
    const form = new FormData();
    if (options.body) {
      form.append("payload", JSON.stringify(options.body));
    }
    for (const file of options.files) {
      form.append("files", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    }
    fetchBody = form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(options.body);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || (options.body || options.files ? "POST" : "GET"),
    headers,
    body: fetchBody,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.errorKey || `HTTP ${res.status}`);
  }
  return data as T;
}

export const mobileApi = {
  async login(email: string, password: string) {
    const res = await mobileRequest<{ ok: boolean; token?: string }>("/login", {
      method: "POST",
      body: { email, password, mobile: true },
    });
    if (res.token) {
      await saveSessionToken(res.token);
    }
    return this.me();
  },

  async logout(pushToken?: string | null) {
    if (pushToken) {
      await mobileRequest("/me/push-token/remove", {
        method: "POST",
        body: { token: pushToken },
      }).catch(() => {});
    }
    await mobileRequest("/logout", { method: "POST" }).catch(() => {});
    await saveSessionToken(null);
  },

  me() {
    return mobileRequest("/me");
  },

  registerPushToken(token: string, platform: "expo" | "ios" | "android" = "expo") {
    return mobileRequest("/me/push-token", {
      method: "POST",
      body: { token, platform },
    });
  },

  getNotifications() {
    return mobileRequest<any[]>("/me/notifications");
  },

  getTickets() {
    return mobileRequest<any[]>("/tickets");
  },

  getTicket(id: number) {
    return mobileRequest<any>(`/tickets/${id}`);
  },

  createTicket(
    body: {
      title: string;
      description: string;
      type: "Hata" | "İstek";
      severity: "s1" | "s2" | "s3";
    },
    files: MediaAttachment[] = [],
  ) {
    return mobileRequest("/tickets", { method: "POST", body, files });
  },

  async signup(body: {
    company_name: string;
    admin_name: string;
    email: string;
    password: string;
    industry_template?: string;
  }) {
    const res = await mobileRequest<{ ok: boolean; token?: string }>(
      "/public/signup",
      {
        method: "POST",
        body,
      },
    );
    if (res.token) {
      await saveSessionToken(res.token);
    }
    return this.me();
  },

  async join(body: {
    invite_code: string;
    name: string;
    email: string;
    password: string;
    company_name?: string;
  }) {
    const res = await mobileRequest<{ ok: boolean; token?: string }>(
      "/public/join",
      {
        method: "POST",
        body,
      },
    );
    if (res.token) {
      await saveSessionToken(res.token);
    }
    return this.me();
  },

  getBillingCatalog() {
    return mobileRequest<any>("/billing/catalog");
  },

  rotateInviteCode() {
    return mobileRequest<{ ok: boolean; invite_code: string }>(
      "/billing/invite-code/rotate",
      { method: "POST", body: {} },
    );
  },

  forgotPassword(email: string) {
    return mobileRequest<{ ok: boolean }>("/public/forgot-password", {
      method: "POST",
      body: { email },
    });
  },

  resendVerification() {
    return mobileRequest<{ ok: boolean }>("/me/verify-email/resend", {
      method: "POST",
      body: {},
    });
  },

  purchaseIap(
    product_id: string,
    store: "app_store" | "play_store" | "stripe" = "app_store",
    transaction_id?: string,
  ) {
    return mobileRequest<any>("/billing/purchase", {
      method: "POST",
      body: { product_id, store, transaction_id },
    });
  },

  ticketAction(id: number, body: Record<string, any>, files: MediaAttachment[] = []) {
    return mobileRequest(`/tickets/${id}/actions`, {
      method: "POST",
      body,
      files,
    });
  },
};
