import { unauthorized } from "./http";
import { requireAdminUnlocked } from "./adminLock";

export interface AdminEnv {
  DB: D1Database;
  ADMIN_CODE: string;
  SESSION_SECRET: string;
}

const cookieName = "yo_admin_session";
const sessionTtlSeconds = 60 * 60 * 8;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type SessionPayload = {
  iat: number;
  exp: number;
};

export async function createSessionCookie(request: Request, env: AdminEnv) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncodeString(
    JSON.stringify({
      iat: now,
      exp: now + sessionTtlSeconds,
    } satisfies SessionPayload),
  );
  const signature = await sign(payload, env.SESSION_SECRET);
  const secure = isLocalRequest(request) ? "" : "; Secure";

  return `${cookieName}=${payload}.${signature}; Max-Age=${sessionTtlSeconds}; Path=/; HttpOnly; SameSite=Strict${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = isLocalRequest(request) ? "" : "; Secure";
  return `${cookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict${secure}`;
}

export async function isValidSession(request: Request, env: AdminEnv) {
  if (!env.SESSION_SECRET) {
    return false;
  }

  const token = getCookie(request, cookieName);
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = await sign(payload, env.SESSION_SECRET);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const decoded = JSON.parse(base64UrlDecodeToString(payload)) as SessionPayload;
    return Number.isFinite(decoded.exp) && decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function requireAdmin(request: Request, env: AdminEnv) {
  const lockedResponse = await requireAdminUnlocked(env);
  if (lockedResponse) {
    return lockedResponse;
  }

  if (!(await isValidSession(request, env))) {
    return unauthorized();
  }

  return null;
}

export function isValidAdminCode(input: string, env: AdminEnv) {
  if (!env.ADMIN_CODE || typeof input !== "string") {
    return false;
  }

  return timingSafeEqual(input, env.ADMIN_CODE);
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

async function sign(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function base64UrlEncodeString(value: string) {
  return base64UrlEncodeBytes(encoder.encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecodeToString(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return decoder.decode(bytes);
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

function isLocalRequest(request: Request) {
  const url = new URL(request.url);
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
}
