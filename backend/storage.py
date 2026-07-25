"""
Storage provider abstraction — future-proof for UploadThing → S3 migration.

To swap providers:
  1. Set STORAGE_PROVIDER=s3 in .env
  2. Add AWS_* env vars
  3. The S3Provider class below implements the identical interface
  4. Zero frontend changes required
"""
import os
from typing import Protocol


class StorageProvider(Protocol):
    """Interface that all storage providers must implement."""
    async def get_upload_url(self, filename: str, mime: str) -> dict:
        """Returns a signed upload token/URL for client-side upload."""
        ...

    async def delete_file(self, key: str) -> None:
        """Deletes a file by its storage key."""
        ...

    def get_public_url(self, key: str) -> str:
        """Returns the public CDN URL for a given storage key."""
        ...


class UploadThingProvider:
    """
    UploadThing storage provider.
    Frontend handles actual upload via @uploadthing/react SDK.
    Backend only needs to record confirmed asset metadata.
    """

    def get_public_url(self, key: str) -> str:
        """UploadThing URLs are returned directly by the SDK on upload confirmation."""
        return key  # key IS the full URL for UploadThing

    async def get_upload_url(self, filename: str, mime: str) -> dict:
        """Not needed for UploadThing — upload handled client-side via SDK."""
        return {"provider": "uploadthing", "note": "Upload via @uploadthing/react SDK"}

    async def delete_file(self, key: str) -> None:
        """TODO: Call UploadThing delete API when implementing server-side deletion."""
        pass


class S3Provider:
    """
    AWS S3 storage provider — activate when migrating from UploadThing.
    Set STORAGE_PROVIDER=s3 and fill AWS_* env vars to switch.
    """
    def __init__(self):
        self.bucket = os.getenv("AWS_BUCKET_NAME", "")
        self.region = os.getenv("AWS_REGION", "ap-south-1")

    def get_public_url(self, key: str) -> str:
        return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{key}"

    async def get_upload_url(self, filename: str, mime: str) -> dict:
        """Generate S3 presigned URL for direct upload from browser."""
        try:
            import boto3
            from botocore.exceptions import ClientError
            s3 = boto3.client(
                "s3",
                region_name=self.region,
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            )
            presigned = s3.generate_presigned_post(
                self.bucket,
                filename,
                Fields={"Content-Type": mime},
                Conditions=[{"Content-Type": mime}, ["content-length-range", 1, 10_000_000]],
                ExpiresIn=300,
            )
            return {"provider": "s3", "presigned": presigned, "key": filename}
        except Exception as e:
            return {"error": str(e)}

    async def delete_file(self, key: str) -> None:
        try:
            import boto3
            s3 = boto3.client(
                "s3",
                region_name=self.region,
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            )
            s3.delete_object(Bucket=self.bucket, Key=key)
        except Exception:
            pass


def get_storage_provider() -> StorageProvider:
    """Returns the active storage provider based on STORAGE_PROVIDER env var."""
    provider = os.getenv("STORAGE_PROVIDER", "uploadthing").lower()
    if provider == "s3":
        return S3Provider()
    return UploadThingProvider()


# Singleton — import this in main.py
storage = get_storage_provider()
