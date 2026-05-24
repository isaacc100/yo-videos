import type { Env } from "./videos";

export type AppSettings = {
  parentGuideUrl: string;
};

export type SettingsInput = {
  parentGuideUrl?: unknown;
  parent_guide_url?: unknown;
};

const parentGuideKey = "parent_guide_url";

export async function getAppSettings(db: Env["DB"]): Promise<AppSettings> {
  const row = await db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .bind(parentGuideKey)
    .first<{ value: string }>();

  return {
    parentGuideUrl: row?.value ?? "",
  };
}

export async function updateAppSettings(db: Env["DB"], input: SettingsInput): Promise<AppSettings> {
  const parentGuideUrl = readUrl(input.parentGuideUrl ?? input.parent_guide_url, "Parent guide URL", false);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(parentGuideKey, parentGuideUrl, now)
    .run();

  return getAppSettings(db);
}

function readUrl(value: unknown, label: string, required: boolean) {
  if (value === undefined || value === null || value === "") {
    if (!required) return "";
    throw new Error(`${label} is required.`);
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a URL.`);
  }

  const trimmed = value.trim();
  if (!trimmed && !required) {
    return "";
  }

  if (trimmed.length > 2048) {
    throw new Error(`${label} is too long.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${label} must use http or https.`);
  }

  return parsed.toString();
}
