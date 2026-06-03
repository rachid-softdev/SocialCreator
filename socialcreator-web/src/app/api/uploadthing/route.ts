import { createRouteHandler, createUploadthing, type FileRouter } from "uploadthing/next";
import logger from "@/lib/logger";

const f = createUploadthing();

const uploadRouter = {
  videoUpload: f({ video: { maxFileSize: "512MB", maxFileCount: 1 } }).onUploadComplete(
    async ({ file }) => {
      logger.info({ url: file.url }, "Upload complete");
      return { url: file.url, key: file.key };
    },
  ),
} satisfies FileRouter;

export type AppUploadRouter = typeof uploadRouter;

export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
});
