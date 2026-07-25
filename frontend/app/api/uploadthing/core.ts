import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  /** Product images — up to 10 images, max 4MB each */
  productImage: f({ image: { maxFileSize: "4MB", maxFileCount: 10 } })
    .middleware(async () => {
      // In production: validate admin JWT here
      return { uploadedBy: "admin" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("[UploadThing] Product image uploaded:", file.url);
      return { url: file.url, key: file.key, name: file.name, size: file.size };
    }),

  /** Lookbook / banner images — up to 5, max 8MB each */
  lookbookImage: f({ image: { maxFileSize: "8MB", maxFileCount: 5 } })
    .middleware(async () => ({ uploadedBy: "admin" }))
    .onUploadComplete(async ({ file }) => {
      return { url: file.url, key: file.key };
    }),

  /** Collection cover image — 1 image, max 4MB */
  collectionImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => ({ uploadedBy: "admin" }))
    .onUploadComplete(async ({ file }) => {
      return { url: file.url, key: file.key };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
