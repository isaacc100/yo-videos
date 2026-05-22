export interface Env {
  DB: D1Database;
  ADMIN_CODE: string;
  SESSION_SECRET: string;
  VIDEOS_BUCKET: R2Bucket;
}

export type Video = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VideoInput = {
  title?: unknown;
  description?: unknown;
  videoUrl?: unknown;
  video_url?: unknown;
  thumbnailUrl?: unknown;
  thumbnail_url?: unknown;
  sortOrder?: unknown;
  sort_order?: unknown;
  published?: unknown;
};

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  sort_order: number;
  published: number;
  created_at: string;
  updated_at: string;
};

const selectColumns = `
  id,
  title,
  description,
  video_url,
  thumbnail_url,
  sort_order,
  published,
  created_at,
  updated_at
`;

export async function listPublishedVideos(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT ${selectColumns}
       FROM videos
       WHERE published = 1
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all<VideoRow>();

  return (result.results ?? []).map(normalizeVideo);
}

export async function listAllVideos(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT ${selectColumns}
       FROM videos
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all<VideoRow>();

  return (result.results ?? []).map(normalizeVideo);
}

export async function getVideoById(db: D1Database, id: string) {
  const row = await db
    .prepare(`SELECT ${selectColumns} FROM videos WHERE id = ?`)
    .bind(id)
    .first<VideoRow>();

  return row ? normalizeVideo(row) : null;
}

export async function createVideo(db: D1Database, input: VideoInput) {
  const fallbackSortOrder = await getNextSortOrder(db);
  const data = validateVideoInput(input, fallbackSortOrder);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO videos (
        id,
        title,
        description,
        video_url,
        thumbnail_url,
        sort_order,
        published,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      data.title,
      data.description,
      data.videoUrl,
      data.thumbnailUrl,
      data.sortOrder,
      data.published ? 1 : 0,
      now,
      now,
    )
    .run();

  return getVideoById(db, id);
}

export async function updateVideo(db: D1Database, id: string, input: VideoInput, existing: Video) {
  const data = validateVideoInput(input, existing.sortOrder);
  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE videos
       SET title = ?,
           description = ?,
           video_url = ?,
           thumbnail_url = ?,
           sort_order = ?,
           published = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      data.title,
      data.description,
      data.videoUrl,
      data.thumbnailUrl,
      data.sortOrder,
      data.published ? 1 : 0,
      now,
      id,
    )
    .run();

  return getVideoById(db, id);
}

export async function deleteVideo(db: D1Database, id: string) {
  await db.prepare("DELETE FROM videos WHERE id = ?").bind(id).run();
}

export async function reorderVideos(db: D1Database, ids: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("Provide at least one video ID to reorder.");
  }

  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length || ids.some((id) => typeof id !== "string" || id.trim() === "")) {
    throw new Error("Video IDs must be unique strings.");
  }

  const now = new Date().toISOString();
  await db.batch(
    ids.map((id, index) =>
      db
        .prepare("UPDATE videos SET sort_order = ?, updated_at = ? WHERE id = ?")
        .bind(index, now, id),
    ),
  );

  return listAllVideos(db);
}

function normalizeVideo(row: VideoRow): Video {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url ?? "",
    sortOrder: Number(row.sort_order),
    published: Boolean(row.published),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getNextSortOrder(db: D1Database) {
  const row = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM videos").first<{
    next_order: number;
  }>();

  return Number(row?.next_order ?? 0);
}

function validateVideoInput(input: VideoInput, fallbackSortOrder: number) {
  const title = readString(input.title, "Title", 120, true);
  const description = readString(input.description, "Description", 1000, false);
  const videoUrl = readUrl(input.videoUrl ?? input.video_url, "Video URL", true);
  const thumbnailUrl = readUrl(input.thumbnailUrl ?? input.thumbnail_url, "Thumbnail URL", false);
  const sortOrder = readSortOrder(input.sortOrder ?? input.sort_order, fallbackSortOrder);
  const published = typeof input.published === "boolean" ? input.published : Boolean(input.published);

  return {
    title,
    description,
    videoUrl,
    thumbnailUrl,
    sortOrder,
    published,
  };
}

function readString(value: unknown, label: string, maxLength: number, required: boolean) {
  if (typeof value !== "string") {
    if (!required) return "";
    throw new Error(`${label} is required.`);
  }

  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw new Error(`${label} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
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

function readSortOrder(value: unknown, fallbackSortOrder: number) {
  if (value === undefined || value === null || value === "") {
    return fallbackSortOrder;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000000) {
    throw new Error("Sort order must be a whole number from 0 to 1000000.");
  }

  return parsed;
}
