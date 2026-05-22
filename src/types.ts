export type Video = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VideoPayload = {
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  sortOrder?: number;
  published: boolean;
};
