import type { Env } from "../_lib/videos";

type MediaParams = {
  key?: string | string[];
};

type ParsedRange = {
  offset: number;
  length: number;
  end: number;
};

export const onRequestGet: PagesFunction<Env, keyof MediaParams> = async ({ request, env, params }) => {
  return serveMedia(request, env, readMediaKey(params.key), true);
};

export const onRequestHead: PagesFunction<Env, keyof MediaParams> = async ({ request, env, params }) => {
  return serveMedia(request, env, readMediaKey(params.key), false);
};

export function onRequestPost() {
  return methodNotAllowed();
}

async function serveMedia(request: Request, env: Env, key: string, includeBody: boolean) {
  if (!isAllowedMediaKey(key)) {
    return new Response("Not found.", { status: 404 });
  }

  const metadata = await env.VIDEOS_BUCKET.head(key);
  if (!metadata) {
    return new Response("Not found.", { status: 404 });
  }

  const range = parseRange(request.headers.get("Range"), metadata.size);
  if (range === "invalid") {
    return new Response("Invalid range.", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${metadata.size}`,
      },
    });
  }

  if (!includeBody) {
    const headers = new Headers();
    metadata.writeHttpMetadata(headers);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("ETag", metadata.httpEtag);
    headers.set("Content-Length", String(range ? range.length : metadata.size));
    if (range) {
      headers.set("Content-Range", `bytes ${range.offset}-${range.end}/${metadata.size}`);
    }

    return new Response(null, {
      status: range ? 206 : 200,
      headers,
    });
  }

  const object = await env.VIDEOS_BUCKET.get(key, range ? { range } : undefined);
  if (!object || !("body" in object)) {
    return new Response("Not found.", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", object.httpEtag);

  if (range) {
    headers.set("Content-Range", `bytes ${range.offset}-${range.end}/${metadata.size}`);
    headers.set("Content-Length", String(range.length));
  } else {
    headers.set("Content-Length", String(metadata.size));
  }

  return new Response(includeBody ? object.body : null, {
    status: range ? 206 : 200,
    headers,
  });
}

function readMediaKey(value: string | string[] | undefined) {
  const parts = Array.isArray(value) ? value : value ? [value] : [];
  return parts.map((part) => safeDecodeURIComponent(part)).join("/");
}

function isAllowedMediaKey(key: string) {
  return (
    (key.startsWith("videos/") || key.startsWith("thumbnails/") || key.startsWith("guides/")) &&
    !key.includes("..") &&
    !key.includes("\\")
  );
}

function parseRange(header: string | null, size: number): ParsedRange | "invalid" | null {
  if (!header) return null;

  const match = header.match(/^bytes=(\d*)-(\d*)$/u);
  if (!match) return "invalid";

  const [, startText, endText] = match;
  if (!startText && !endText) return "invalid";

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return "invalid";
    const length = Math.min(suffixLength, size);
    const offset = size - length;
    return { offset, length, end: size - 1 };
  }

  const offset = Number(startText);
  const requestedEnd = endText ? Number(endText) : size - 1;
  if (
    !Number.isInteger(offset) ||
    !Number.isInteger(requestedEnd) ||
    offset < 0 ||
    requestedEnd < offset ||
    offset >= size
  ) {
    return "invalid";
  }

  const end = Math.min(requestedEnd, size - 1);
  return { offset, length: end - offset + 1, end };
}

function methodNotAllowed() {
  return new Response("Method not allowed.", {
    status: 405,
    headers: {
      Allow: "GET, HEAD",
    },
  });
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
