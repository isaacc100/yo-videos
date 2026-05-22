import { clearSessionCookie } from "../../_lib/auth";
import { json, methodNotAllowed } from "../../_lib/http";
import { Env } from "../../_lib/videos";

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  const headers = new Headers();
  headers.append("Set-Cookie", clearSessionCookie(request));

  return json({ ok: true }, { headers });
};

export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
