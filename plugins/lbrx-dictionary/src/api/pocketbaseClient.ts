import type { LbrxDictionarySettings } from "../settings";
import type { PocketBaseAuthResponse, PocketBaseListResponse } from "../types";

/** Decodes the `exp` (seconds since epoch) claim from a JWT without verifying its signature. */
function decodeJwtExpiry(token: string): number | undefined {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json) as { exp?: number };
    return typeof parsed.exp === "number" ? parsed.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

/** Escapes a value for safe use inside a PocketBase filter expression. */
export function escapePbFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** PocketBase error responses look like `{ code, message, data }`; surface `message` when present. */
async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as { message?: string };
    if (body?.message) return body.message;
  } catch {
    // response wasn't JSON; fall through to raw text below.
  }
  try {
    const text = await res.text();
    return text || "알 수 없는 오류";
  } catch {
    return "알 수 없는 오류";
  }
}

/**
 * Thin REST client for PocketBase: handles login (auth-with-password) and
 * authenticated record listing. Kept dependency-free (uses global fetch)
 * instead of the pocketbase npm SDK to keep the bundle small.
 */
export class PocketBaseClient {
  private token: string | undefined;
  private tokenExpiresAt = 0;
  private loginPromise: Promise<void> | undefined;

  constructor(private readonly getSettings: () => LbrxDictionarySettings) {}

  private get baseUrl(): string {
    return this.getSettings().pocketbaseUrl.replace(/\/+$/, "");
  }

  /** Ensures we hold a non-expired auth token, logging in if necessary. */
  async ensureAuthenticated(): Promise<void> {
    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt - 30_000) {
      return;
    }
    if (!this.loginPromise) {
      this.loginPromise = this.login().finally(() => {
        this.loginPromise = undefined;
      });
    }
    await this.loginPromise;
  }

  private async login(): Promise<void> {
    const settings = this.getSettings();
    if (!settings.identity || !settings.password) {
      throw new Error("LBRX Dictionary: 설정에서 PocketBase 로그인 정보를 입력하세요.");
    }

    const res = await fetch(
      `${this.baseUrl}/api/collections/${encodeURIComponent(settings.authCollection)}/auth-with-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity: settings.identity, password: settings.password }),
      },
    );

    if (!res.ok) {
      throw new Error(`LBRX Dictionary: PocketBase 로그인 실패 (${res.status}) - ${await extractErrorMessage(res)}`);
    }

    const data = (await res.json()) as PocketBaseAuthResponse;
    this.token = data.token;
    this.tokenExpiresAt = decodeJwtExpiry(data.token) ?? Date.now() + 5 * 60_000;
  }

  /** Lists records from a PocketBase collection/view, with an optional filter expression. */
  async listRecords<T>(collection: string, filter?: string, perPage = 20): Promise<T[]> {
    await this.ensureAuthenticated();

    const params = new URLSearchParams({ perPage: String(perPage) });
    if (filter) params.set("filter", filter);

    const res = await fetch(
      `${this.baseUrl}/api/collections/${encodeURIComponent(collection)}/records?${params.toString()}`,
      {
        headers: this.token ? { Authorization: this.token } : undefined,
      },
    );

    if (res.status === 401) {
      // Token might have been rejected server-side; force a fresh login once.
      this.token = undefined;
      this.tokenExpiresAt = 0;
      await this.ensureAuthenticated();
      return this.listRecords<T>(collection, filter, perPage);
    }

    if (!res.ok) {
      throw new Error(`LBRX Dictionary: "${collection}" 조회 실패 (${res.status}) - ${await extractErrorMessage(res)}`);
    }

    const data = (await res.json()) as PocketBaseListResponse<T>;
    return data.items;
  }
}
