import { requireAdmin } from "../../../_lib/auth";
import { badRequest, json, methodNotAllowed, notFound, readJson } from "../../../_lib/http";
import { deleteVideo, Env, getVideoById, updateVideo, VideoInput } from "../../../_lib/videos";

export const onRequestPut: PagesFunction<Env, "id"> = async ({ request, env, params }) => {
  const authResponse = await requireAdmin(request, env);
  if (authResponse) return authResponse;

  const id = readRouteId(params.id);
  const existing = await getVideoById(env.DB, id);
  if (!existing) {
    return notFound("Video not found.");
  }

  try {
    const body = await readJson<VideoInput>(request);
    const video = await updateVideo(env.DB, id, body, existing);
    return json({ video });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Video could not be updated.");
  }
};

export const onRequestDelete: PagesFunction<Env, "id"> = async ({ request, env, params }) => {
  const authResponse = await requireAdmin(request, env);
  if (authResponse) return authResponse;

  const id = readRouteId(params.id);
  const existing = await getVideoById(env.DB, id);
  if (!existing) {
    return notFound("Video not found.");
  }

  await deleteVideo(env.DB, id);
  return json({ ok: true });
};

export const onRequestGet = methodNotAllowed;
export const onRequestPost = methodNotAllowed;

function readRouteId(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}
