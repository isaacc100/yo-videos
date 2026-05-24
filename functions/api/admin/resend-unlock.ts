import { resendUnlockEmail } from "../../_lib/adminLock";
import { json, methodNotAllowed } from "../../_lib/http";
import type { Env } from "../../_lib/videos";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const result = await resendUnlockEmail(env, request);
  if (result.response) return result.response;

  return json({
    ok: true,
    sent: result.sent,
    nextEmailAt: "nextEmailAt" in result ? result.nextEmailAt : null,
  });
};

export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
