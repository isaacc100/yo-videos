import { recordFailedLogin, recordSuccessfulLogin, requireAdminUnlocked } from "../../_lib/adminLock";
import { createSessionCookie, isValidAdminCode } from "../../_lib/auth";
import { badRequest, json, methodNotAllowed, readJson, unauthorized } from "../../_lib/http";
import { Env } from "../../_lib/videos";

type LoginBody = {
  code?: unknown;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const lockedResponse = await requireAdminUnlocked(env);
  if (lockedResponse) return lockedResponse;

  let body: LoginBody;
  try {
    body = await readJson<LoginBody>(request);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Request body must be valid JSON.");
  }

  if (typeof body.code !== "string") {
    return badRequest("Admin code is required.");
  }

  if (!isValidAdminCode(body.code, env)) {
    const failedLogin = await recordFailedLogin(env, request);
    if (failedLogin.response) return failedLogin.response;
    return unauthorized();
  }

  await recordSuccessfulLogin(env);

  const headers = new Headers();
  headers.append("Set-Cookie", await createSessionCookie(request, env));

  return json({ ok: true }, { headers });
};

export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
