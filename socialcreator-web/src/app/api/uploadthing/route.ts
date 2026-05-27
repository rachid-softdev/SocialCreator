import { createUploadthing, type FileRouter } from "uploadthing/next";
import { createRouteHandler } from "uploadthing/next";

const f = createUploadthing();

const uploadRouter = {
  videoUpload: f({ video: { maxFileSize: "512MB", maxFileCount: 1 } }).onUploadComplete(
    async ({ file }) => {
      console.log("Upload complete:", file.url);
      return { url: file.url, key: file.key };
    },
  ),
} satisfies FileRouter;

export type AppUploadRouter = typeof uploadRouter;

export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
});
