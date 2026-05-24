import { unlockAdmin } from "../../_lib/adminLock";
import { badRequest, json, methodNotAllowed, readJson, unauthorized } from "../../_lib/http";
import type { Env } from "../../_lib/videos";

type UnlockBody = {
  code?: unknown;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: UnlockBody;
  try {
    body = await readJson<UnlockBody>(request);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Request body must be valid JSON.");
  }

  const unlocked = await unlockAdmin(env, body.code);
  if (!unlocked) {
    return unauthorized();
  }

  return json({ ok: true });
};

export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
