import { locked } from "./http";
import type { Env } from "./videos";

const lockId = "admin";
const maxFailedAttempts = 2;
const resendBackoffSeconds = [30, 60, 60 * 60, 24 * 60 * 60];
const unlockEmailTo = "isaac.critchley@sja.org.uk";
const unlockEmailFrom = "yo-vids@registerpro.uk";
const encoder = new TextEncoder();

type LockRow = {
  failed_attempts: number;
  locked: number;
  unlock_hash: string | null;
  email_backoff_step: number;
  next_email_at: string | null;
  reset_secret_hash: string | null;
};

type LockState = {
  failedAttempts: number;
  locked: boolean;
  unlockHash: string;
  emailBackoffStep: number;
  nextEmailAt: string;
  resetSecretHash: string;
};

type LockEnv = {
  DB: D1Database;
};

export async function getAdminLockState(db: D1Database): Promise<LockState> {
  const row = await db
    .prepare(
      `SELECT failed_attempts, locked, unlock_hash, email_backoff_step, next_email_at, reset_secret_hash
       FROM admin_login_lock
       WHERE id = ?`,
    )
    .bind(lockId)
    .first<LockRow>();

  return {
    failedAttempts: Number(row?.failed_attempts ?? 0),
    locked: Boolean(row?.locked),
    unlockHash: row?.unlock_hash ?? "",
    emailBackoffStep: Number(row?.email_backoff_step ?? 0),
    nextEmailAt: row?.next_email_at ?? "",
    resetSecretHash: row?.reset_secret_hash ?? "",
  };
}

export async function getEffectiveAdminLockState(env: LockEnv & Partial<Pick<Env, "ADMIN_UNLOCK_RESET_SECRET">>) {
  const state = await getAdminLockState(env.DB);
  const currentResetHash = env.ADMIN_UNLOCK_RESET_SECRET
    ? await hashUnlockCode(env.ADMIN_UNLOCK_RESET_SECRET)
    : "";

  if (!currentResetHash) {
    return state;
  }

  if (state.resetSecretHash && !timingSafeEqual(currentResetHash, state.resetSecretHash)) {
    await writeLockState(env.DB, {
      failedAttempts: 0,
      locked: false,
      unlockHash: "",
      emailBackoffStep: 0,
      nextEmailAt: "",
      resetSecretHash: currentResetHash,
    });
    return getAdminLockState(env.DB);
  }

  if (!state.resetSecretHash) {
    await writeLockState(env.DB, { ...state, resetSecretHash: currentResetHash });
    return getAdminLockState(env.DB);
  }

  return state;
}

export async function requireAdminUnlocked(env: LockEnv & Partial<Pick<Env, "ADMIN_UNLOCK_RESET_SECRET">>) {
  const state = await getEffectiveAdminLockState(env);
  return state.locked
    ? locked("Admin access is locked. Use the unlock code sent by email.", {
        nextEmailAt: state.nextEmailAt || null,
      })
    : null;
}

export async function recordSuccessfulLogin(env: LockEnv & Partial<Pick<Env, "ADMIN_UNLOCK_RESET_SECRET">>) {
  const state = await getEffectiveAdminLockState(env);
  await writeLockState(env.DB, {
    failedAttempts: 0,
    locked: false,
    unlockHash: "",
    emailBackoffStep: 0,
    nextEmailAt: "",
    resetSecretHash: state.resetSecretHash,
  });
}

export async function recordFailedLogin(env: Env, request: Request) {
  const state = await getEffectiveAdminLockState(env);
  if (state.locked) {
    return {
      locked: true,
      response: locked("Admin access is locked. Use the unlock code sent by email.", {
        nextEmailAt: state.nextEmailAt || null,
      }),
    };
  }

  const failedAttempts = state.failedAttempts + 1;
  if (failedAttempts < maxFailedAttempts) {
    await writeLockState(env.DB, {
      failedAttempts,
      locked: false,
      unlockHash: "",
      emailBackoffStep: 0,
      nextEmailAt: "",
      resetSecretHash: state.resetSecretHash,
    });

    return {
      locked: false,
      response: null,
    };
  }

  return lockAndSendUnlockEmail(env, request, state, failedAttempts);
}

export async function resendUnlockEmail(env: Env, request: Request) {
  const state = await getEffectiveAdminLockState(env);
  if (!state.locked) {
    return {
      sent: false,
      response: null,
    };
  }

  const now = Date.now();
  const nextEmailTime = state.nextEmailAt ? Date.parse(state.nextEmailAt) : 0;
  if (Number.isFinite(nextEmailTime) && nextEmailTime > now) {
    return {
      sent: false,
      response: locked("Please wait before sending another unlock email.", {
        nextEmailAt: state.nextEmailAt,
      }),
    };
  }

  return sendReplacementUnlockEmail(env, request, state);
}

export async function unlockAdmin(env: Env, code: unknown) {
  if (typeof code !== "string" || code.trim() === "") {
    return false;
  }

  const state = await getEffectiveAdminLockState(env);
  if (!state.locked || !state.unlockHash) {
    return true;
  }

  const suppliedHash = await hashUnlockCode(code.trim());
  if (!timingSafeEqual(suppliedHash, state.unlockHash)) {
    return false;
  }

  await writeLockState(env.DB, {
    failedAttempts: 0,
    locked: false,
    unlockHash: "",
    emailBackoffStep: 0,
    nextEmailAt: "",
    resetSecretHash: state.resetSecretHash,
  });

  return true;
}

async function lockAndSendUnlockEmail(env: Env, request: Request, state: LockState, failedAttempts: number) {
  const nextState = await buildNextEmailState(state, failedAttempts);
  await writeLockState(env.DB, nextState);

  try {
    await sendUnlockEmail(env, nextState.unlockCode, request);
  } catch (error) {
    await writeLockState(env.DB, {
      failedAttempts: maxFailedAttempts - 1,
      locked: false,
      unlockHash: "",
      emailBackoffStep: 0,
      nextEmailAt: "",
      resetSecretHash: state.resetSecretHash,
    });
    throw error;
  }

  return {
    locked: true,
    response: locked("Admin access is locked. An unlock code has been sent by email.", {
      nextEmailAt: nextState.nextEmailAt,
    }),
  };
}

async function sendReplacementUnlockEmail(env: Env, request: Request, state: LockState) {
  const nextState = await buildNextEmailState(state, state.failedAttempts);
  await writeLockState(env.DB, nextState);

  try {
    await sendUnlockEmail(env, nextState.unlockCode, request);
  } catch (error) {
    await writeLockState(env.DB, state);
    throw error;
  }

  return {
    sent: true,
    response: null,
    nextEmailAt: nextState.nextEmailAt,
  };
}

async function buildNextEmailState(state: LockState, failedAttempts: number) {
  const unlockCode = createUnlockCode();
  const delaySeconds = getBackoffSeconds(state.emailBackoffStep);
  const nextEmailAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

  return {
    failedAttempts,
    locked: true,
    unlockHash: await hashUnlockCode(unlockCode),
    emailBackoffStep: state.emailBackoffStep + 1,
    nextEmailAt,
    resetSecretHash: state.resetSecretHash,
    unlockCode,
  };
}

async function writeLockState(db: D1Database, state: LockState) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO admin_login_lock (
         id,
         failed_attempts,
         locked,
         unlock_hash,
         email_backoff_step,
         next_email_at,
         reset_secret_hash,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         failed_attempts = excluded.failed_attempts,
         locked = excluded.locked,
         unlock_hash = excluded.unlock_hash,
         email_backoff_step = excluded.email_backoff_step,
         next_email_at = excluded.next_email_at,
         reset_secret_hash = excluded.reset_secret_hash,
         updated_at = excluded.updated_at`,
    )
    .bind(
      lockId,
      state.failedAttempts,
      state.locked ? 1 : 0,
      state.unlockHash || null,
      state.emailBackoffStep,
      state.nextEmailAt || null,
      state.resetSecretHash || null,
      now,
    )
    .run();
}

async function sendUnlockEmail(env: Env, unlockCode: string, request: Request) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const url = new URL(request.url);
  const unlockUrl = `${url.origin}/admin`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: unlockEmailFrom,
      to: unlockEmailTo,
      subject: "Youth Onboarding videos admin unlock code",
      text: [
        "The Youth Onboarding videos admin area has been locked after two failed sign-in attempts.",
        "",
        `Unlock code: ${unlockCode}`,
        "",
        `Open ${unlockUrl} and use this code to unlock the admin area.`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error("The unlock email could not be sent.");
  }
}

function createUnlockCode() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function hashUnlockCode(code: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(code));
  return base64UrlEncode(new Uint8Array(hash));
}

function getBackoffSeconds(step: number) {
  return resendBackoffSeconds[Math.min(Math.max(step, 0), resendBackoffSeconds.length - 1)];
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
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
