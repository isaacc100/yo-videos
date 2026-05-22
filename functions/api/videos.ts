import { json, methodNotAllowed } from "../_lib/http";
import { Env, listPublishedVideos } from "../_lib/videos";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const videos = await listPublishedVideos(env.DB);
  return json({ videos });
};

export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
