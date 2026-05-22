import { isValidSession } from "../../_lib/auth";
import { json, methodNotAllowed, unauthorized } from "../../_lib/http";
import { Env } from "../../_lib/videos";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isValidSession(request, env))) {
    return unauthorized();
  }

  return json({ authenticated: true });
};

export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
