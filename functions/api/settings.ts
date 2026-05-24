import { json, methodNotAllowed } from "../_lib/http";
import { getAppSettings } from "../_lib/settings";
import type { Env } from "../_lib/videos";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const settings = await getAppSettings(env.DB);
  return json({ settings });
};

export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
