/**
 * S3 Client Upload Utility — Direct Browser-to-S3 Uploads using Presigned PUT URLs.
 */
import { getS3PresignedUrl } from "./api/admin";

export interface S3UploadedImage {
  url: string;
  key: string;
  name: string;
  size?: number;
}

/**
 * Uploads a single file directly to Amazon S3 via a presigned PUT URL.
 */
export async function uploadFileToS3(
  file: File,
  folder: string = "products",
  adminToken?: string
): Promise<S3UploadedImage> {
  const token = adminToken || (typeof window !== "undefined" ? localStorage.getItem("vahn_admin_token") || "" : "");
  if (!token) {
    throw new Error("Admin authentication required for S3 upload.");
  }

  const mimeType = file.type || "application/octet-stream";

  // 1. Request presigned PUT URL from backend
  const presigned = await getS3PresignedUrl(token, {
    filename: file.name,
    mime_type: mimeType,
    folder,
  });

  if (!presigned.upload_url || !presigned.public_url) {
    throw new Error("Failed to get S3 presigned upload URL.");
  }

  // 2. Upload file directly to S3 bucket via PUT
  const res = await fetch(presigned.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: file,
  });

  if (!res.ok) {
    throw new Error(`S3 upload failed with status ${res.status}: ${res.statusText}`);
  }

  return {
    url: presigned.public_url,
    key: presigned.key,
    name: file.name,
    size: file.size,
  };
}

/**
 * Uploads multiple files in parallel to Amazon S3.
 */
export async function uploadMultipleFilesToS3(
  files: File[],
  folder: string = "products",
  adminToken?: string
): Promise<S3UploadedImage[]> {
  const uploadPromises = files.map((file) => uploadFileToS3(file, folder, adminToken));
  return Promise.all(uploadPromises);
}
