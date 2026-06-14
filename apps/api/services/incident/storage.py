from mimetypes import guess_type
from core.s3 import get_r2_client


async def upload_photo(photo_bytes: bytes, filename: str) -> str | None:
    client = get_r2_client()
    content_type, _ = guess_type(filename)
    if not content_type:
        content_type = "image/jpeg"
        
    return await client.upload_file(
        file_bytes=photo_bytes,
        filename=filename,
        content_type=content_type
    )
