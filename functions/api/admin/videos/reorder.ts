import { requireAdmin } from "../../../_lib/auth";
import { badRequest, json, methodNotAllowed, readJson } from "../../../_lib/http";
import { Env, reorderVideos } from "../../../_lib/videos";

type ReorderBody = {
  ids?: unknown;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authResponse = await requireAdmin(request, env);
  if (authResponse) return authResponse;

  try {
    const body = await readJson<ReorderBody>(request);
    if (!Array.isArray(body.ids)) {
      return badRequest("Video IDs are required.");
    }
    const videos = await reorderVideos(env.DB, body.ids);
    return json({ videos });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Videos could not be reordered.");
  }
};

export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
