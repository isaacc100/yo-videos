import { createSessionCookie, isValidAdminCode } from "../../_lib/auth";
import { badRequest, json, methodNotAllowed, readJson, unauthorized } from "../../_lib/http";
import { Env } from "../../_lib/videos";

type LoginBody = {
  code?: unknown;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<LoginBody>(request);
  if (typeof body.code !== "string") {
    return badRequest("Admin code is required.");
  }

  if (!isValidAdminCode(body.code, env)) {
    return unauthorized();
  }

  const headers = new Headers();
  headers.append("Set-Cookie", await createSessionCookie(request, env));

  return json({ ok: true }, { headers });
};

export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
