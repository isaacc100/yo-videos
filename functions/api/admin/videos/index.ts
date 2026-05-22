import { requireAdmin } from "../../../_lib/auth";
import { badRequest, json, methodNotAllowed, readJson } from "../../../_lib/http";
import { createVideo, Env, listAllVideos, VideoInput } from "../../../_lib/videos";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authResponse = await requireAdmin(request, env);
  if (authResponse) return authResponse;

  const videos = await listAllVideos(env.DB);
  return json({ videos });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authResponse = await requireAdmin(request, env);
  if (authResponse) return authResponse;

  try {
    const body = await readJson<VideoInput>(request);
    const video = await createVideo(env.DB, body);
    return json({ video }, { status: 201 });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Video could not be created.");
  }
};

export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
