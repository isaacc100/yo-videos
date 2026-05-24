import { requireAdmin } from "../../_lib/auth";
import { badRequest, json, methodNotAllowed, readJson } from "../../_lib/http";
import { getAppSettings, SettingsInput, updateAppSettings } from "../../_lib/settings";
import type { Env } from "../../_lib/videos";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authResponse = await requireAdmin(request, env);
  if (authResponse) return authResponse;

  const settings = await getAppSettings(env.DB);
  return json({ settings });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const authResponse = await requireAdmin(request, env);
  if (authResponse) return authResponse;

  try {
    const body = await readJson<SettingsInput>(request);
    const settings = await updateAppSettings(env.DB, body);
    return json({ settings });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Settings could not be saved.");
  }
};

export const onRequestPost = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
