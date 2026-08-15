"""
AWS S3 Storage Provider — VAHN Media Storage.
All photos, videos, lookbook cards, and assets upload directly to S3.
"""
import os
import uuid
import re
import mimetypes
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()


def sanitize_filename(filename: str) -> str:
    """Strip dangerous characters from filename."""
    base = os.path.basename(filename)
    safe = re.sub(r'[^a-zA-Z0-9._-]', '_', base)
    return safe or "media_asset"


class S3Provider:
    """
    AWS S3 storage provider.
    Provides presigned PUT URLs for browser direct uploads and direct server upload capability.
    """
    @property
    def bucket(self) -> str:
        return os.getenv("AWS_BUCKET_NAME", "vahn")

    @property
    def region(self) -> str:
        return os.getenv("AWS_REGION", "ap-south-2")

    @property
    def access_key(self) -> str:
        return os.getenv("AWS_ACCESS_KEY_ID", "")

    @property
    def secret_key(self) -> str:
        return os.getenv("AWS_SECRET_ACCESS_KEY", "")

    def _get_client(self):
        import boto3
        return boto3.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
        )

    def get_public_url(self, key: str) -> str:
        """Returns the public S3 URL for a given key."""
        return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{key}"

    def generate_key(self, filename: str, folder: str = "products") -> str:
        """Generates a clean, unique S3 object key."""
        safe_name = sanitize_filename(filename)
        uid = uuid.uuid4().hex[:10]
        folder = folder.strip("/")
        return f"{folder}/{uid}_{safe_name}"

    def get_presigned_upload_url(self, filename: str, mime: str, folder: str = "products") -> Dict[str, Any]:
        """
        Generate S3 presigned PUT URL for direct upload from browser.
        Returns:
            upload_url: The presigned URL to PUT the file to
            public_url: The permanent public URL after upload completes
            key: The S3 object key
        """
        try:
            s3 = self._get_client()
            key = self.generate_key(filename, folder=folder)

            # Generate presigned PUT url
            presigned_url = s3.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": key,
                    "ContentType": mime,
                },
                ExpiresIn=600,  # 10 minutes
            )

            public_url = self.get_public_url(key)

            return {
                "provider": "s3",
                "upload_url": presigned_url,
                "public_url": public_url,
                "key": key,
                "bucket": self.bucket,
                "region": self.region,
            }
        except Exception as e:
            return {"error": str(e)}

    def upload_file_bytes(self, file_bytes: bytes, key: str, mime: str) -> str:
        """Direct server-side upload of file bytes into S3."""
        s3 = self._get_client()
        s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_bytes,
            ContentType=mime,
        )
        return self.get_public_url(key)

    def extract_key(self, key_or_url: Optional[str]) -> Optional[str]:
        """Extract the S3 object key from an S3 URL or return the raw key."""
        if not key_or_url or not isinstance(key_or_url, str):
            return None
        cleaned = key_or_url.strip()
        if not cleaned:
            return None

        # If it's a full URL
        if cleaned.startswith("http://") or cleaned.startswith("https://"):
            import urllib.parse
            parsed = urllib.parse.urlparse(cleaned)
            path = parsed.path.lstrip("/")

            # If path starts with bucket name: e.g. /vahn/products/...
            if self.bucket and path.startswith(f"{self.bucket}/"):
                path = path[len(self.bucket) + 1:]

            decoded_key = urllib.parse.unquote(path)
            return decoded_key if decoded_key else None

        return cleaned

    def delete_file(self, key_or_url: Optional[str]) -> bool:
        """Deletes a file by its storage key or public S3 URL."""
        key = self.extract_key(key_or_url)
        if not key:
            return False
        try:
            s3 = self._get_client()
            s3.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception as e:
            print(f"[S3 DELETE] Failed to delete key '{key}': {e}")
            return False

    def delete_files(self, keys_or_urls: list) -> int:
        """Deletes multiple files from S3 given a list of keys or URLs."""
        if not keys_or_urls:
            return 0
        valid_keys = [self.extract_key(k) for k in keys_or_urls if k]
        valid_keys = list(set([k for k in valid_keys if k]))
        if not valid_keys:
            return 0

        deleted_count = 0
        try:
            s3 = self._get_client()
            for i in range(0, len(valid_keys), 1000):
                chunk = valid_keys[i:i + 1000]
                objects = [{"Key": k} for k in chunk]
                s3.delete_objects(
                    Bucket=self.bucket,
                    Delete={"Objects": objects, "Quiet": True}
                )
                deleted_count += len(chunk)
        except Exception as e:
            print(f"[S3 BATCH DELETE] {e}")
            for k in valid_keys:
                if self.delete_file(k):
                    deleted_count += 1
        return deleted_count


# Singleton instance
storage = S3Provider()
