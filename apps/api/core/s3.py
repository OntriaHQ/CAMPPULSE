import os
import uuid
import aioboto3
from core.exceptions import AppError

class R2Client:
    def __init__(self):
        self.account_id = os.getenv("R2_ACCOUNT_ID")
        self.access_key_id = os.getenv("R2_ACCESS_KEY_ID")
        self.secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = os.getenv("R2_BUCKET_NAME")
        self.public_url = os.getenv("R2_PUBLIC_URL")
        
        self.endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
        
        self.session = aioboto3.Session()

    async def upload_file(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        if not all([self.account_id, self.access_key_id, self.secret_access_key, self.bucket_name]):
            # Fallback to local storage or error if in production
            if os.getenv("ENV") == "production":
                raise AppError("R2_CONFIG_MISSING", "Cloudflare R2 is not configured.")
            return f"/uploads/{filename}"

        ext = os.path.splitext(filename)[1]
        stored_name = f"{uuid.uuid4()}{ext}"
        
        async with self.session.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
        ) as s3:
            await s3.put_object(
                Bucket=self.bucket_name,
                Key=stored_name,
                Body=file_bytes,
                ContentType=content_type,
            )
            
        return f"{self.public_url}/{stored_name}"

_client = None

def get_r2_client() -> R2Client:
    global _client
    if _client is None:
        _client = R2Client()
    return _client
