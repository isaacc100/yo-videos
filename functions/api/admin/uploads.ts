import { requireAdmin } from "../../_lib/auth";
import { badRequest, json, methodNotAllowed } from "../../_lib/http";
import type { Env } from "../../_lib/videos";

type UploadKind = "video" | "thumbnail" | "guide";

const videoExtensions = new Set(["mp4", "m4v", "mov", "webm", "ogv", "ogg"]);
const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const documentExtensions = new Set(["pdf"]);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authResponse = await requireAdmin(request, env);
  if (authResponse) return authResponse;

  if (!request.body) {
    return badRequest("Choose a file to upload.");
  }

  const kind = readUploadKind(request.headers.get("X-Upload-Type"));
  if (!kind) {
    return badRequest("Upload type must be video or thumbnail.");
  }

  const contentType = readContentType(request.headers.get("Content-Type"));
  const originalName = readOriginalName(request.headers.get("X-File-Name"));
  const extension = readExtension(originalName, contentType, kind);

  if (!isAllowedFile(kind, contentType, extension)) {
    return badRequest(readUploadError(kind));
  }

  const key = buildObjectKey(kind, originalName, extension);

  await env.VIDEOS_BUCKET.put(key, request.body, {
    httpMetadata: {
      contentType,
      contentDisposition: `inline; filename="${escapeHeaderValue(sanitizeFileName(originalName))}"`,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      originalName,
      uploadKind: kind,
    },
  });

  const url = new URL(`/media/${key}`, request.url).toString();
  return json({ key, url });
};

export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;

function readUploadKind(value: string | null): UploadKind | null {
  if (value === "video" || value === "thumbnail" || value === "guide") {
    return value;
  }
  return null;
}

function readContentType(value: string | null) {
  const contentType = value?.split(";")[0]?.trim().toLowerCase();
  return contentType || "application/octet-stream";
}

function readOriginalName(value: string | null) {
  const decoded = value ? safeDecodeURIComponent(value) : "upload";
  const trimmed = decoded.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 180) : "upload";
}

function readExtension(fileName: string, contentType: string, kind: UploadKind) {
  const fromName = fileName.match(/\.([a-z0-9]+)$/iu)?.[1]?.toLowerCase();
  if (fromName) return fromName;

  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "video/mp4") return "mp4";
  if (contentType === "video/webm") return "webm";
  if (contentType === "video/quicktime") return "mov";
  if (contentType === "application/pdf") return "pdf";

  if (kind === "video") return "mp4";
  if (kind === "guide") return "pdf";
  return "jpg";
}

function isAllowedFile(kind: UploadKind, contentType: string, extension: string) {
  if (kind === "video") {
    return contentType.startsWith("video/") && videoExtensions.has(extension);
  }

  if (kind === "guide") {
    return contentType === "application/pdf" && documentExtensions.has(extension);
  }

  return contentType.startsWith("image/") && imageExtensions.has(extension);
}

function buildObjectKey(kind: UploadKind, originalName: string, extension: string) {
  const prefix = kind === "video" ? "videos" : kind === "guide" ? "guides" : "thumbnails";
  const today = new Date().toISOString().slice(0, 10);
  const baseName = sanitizeFileName(originalName).replace(/\.[a-z0-9]+$/iu, "");
  return `${prefix}/${today}/${crypto.randomUUID()}-${baseName}.${extension}`;
}

function readUploadError(kind: UploadKind) {
  if (kind === "video") return "Upload a valid video file.";
  if (kind === "guide") return "Upload a valid PDF file.";
  return "Upload a valid image file.";
}

function sanitizeFileName(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w.-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();

  return cleaned || "upload";
}

function escapeHeaderValue(value: string) {
  return value.replace(/["\\\r\n]/gu, "").replace(/[^\x20-\x7e]/gu, "");
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
