import { createUploadThing, type FileRouter } from "uploadthing";

const f = createUploadThing({
  define: () => ({
    videoUpload: "video",
  }),
});

export const uploadRouter = {
  videoUpload: f({
    video: ({ file }) => {
      return {
        url: file.url,
        key: file.key,
      };
    },
  }),
} satisfies FileRouter;

export type AppUploadRouter = typeof uploadRouter;
