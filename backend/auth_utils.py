import os
import secrets
import hashlib
import json
import base64
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
import models

SECRET_KEY = os.getenv("JWT_SECRET", "vahn_secret_jwt_key_2026_super_secure_987654321")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

security = HTTPBearer(auto_error=False)

def generate_salt() -> str:
    """Generates a random 16-byte hex salt."""
    return secrets.token_hex(16)

def hash_password(password: str, salt: str) -> str:
    """Hashes password with salt using SHA-256."""
    salted = f"{password}{salt}{SECRET_KEY}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()

def verify_password(plain_password: str, password_hash: str, salt: str) -> bool:
    """Verifies plain password against stored hash and salt."""
    return hash_password(plain_password, salt) == password_hash

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def base64url_decode(encoded_str: str) -> bytes:
    padding = '=' * (4 - (len(encoded_str) % 4))
    return base64.urlsafe_b64decode(encoded_str + padding)

def create_access_token(user_id: int, email: str, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT token."""
    header = {"alg": ALGORITHM, "typ": "JWT"}
    now = datetime.utcnow()
    expire = now + (expires_delta if expires_delta else timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }

    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))
    
    signature_base = f"{header_b64}.{payload_b64}"
    signature = hashlib.sha256(f"{signature_base}.{SECRET_KEY}".encode('utf-8')).hexdigest()
    
    return f"{signature_base}.{signature}"

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates JWT token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        
        header_b64, payload_b64, signature = parts
        expected_sig = hashlib.sha256(f"{header_b64}.{payload_b64}.{SECRET_KEY}".encode('utf-8')).hexdigest()
        
        if not secrets.compare_digest(signature, expected_sig):
            return None
        
        payload_bytes = base64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        if payload.get("exp") and datetime.utcnow().timestamp() > payload["exp"]:
            return None
            
        return payload
    except Exception:
        return None

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security), db: Session = Depends(get_db)) -> models.User:
    """FastAPI security dependency to get currently authenticated user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = int(payload.get("sub", 0))
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    return user
