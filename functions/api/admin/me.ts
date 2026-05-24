import { requireAdmin } from "../../_lib/auth";
import { json, methodNotAllowed, unauthorized } from "../../_lib/http";
import { Env } from "../../_lib/videos";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authResponse = await requireAdmin(request, env);
  if (authResponse) return authResponse.status === 401 ? unauthorized() : authResponse;

  return json({ authenticated: true });
};

export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
