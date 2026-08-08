import os
import re
import secrets
import hashlib
import hmac
import json
import base64
import threading
import time
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

# OTP config
OTP_EXPIRE_SECONDS = 300       # 5 minutes
OTP_RATE_LIMIT_COUNT = 3       # max OTP sends per window
OTP_RATE_LIMIT_WINDOW = 30     # 30-second window (seconds)
OTP_MAX_ATTEMPTS = 5           # max wrong OTP attempts per token

security = HTTPBearer(auto_error=False)

# ============================================================
# Phone Validation
# ============================================================

PHONE_E164_RE = re.compile(r'^\+[1-9]\d{6,14}$')

def normalize_phone(phone: str) -> str:
    """
    Strip spaces/dashes and ensure E.164 format.
    Raises ValueError if invalid.
    """
    cleaned = re.sub(r'[\s\-\(\)]', '', phone.strip())
    # Auto-prefix India +91 for 10-digit numbers
    if re.match(r'^[6-9]\d{9}$', cleaned):
        cleaned = '+91' + cleaned
    if not PHONE_E164_RE.match(cleaned):
        raise ValueError(
            "Invalid phone number. Use E.164 format (e.g. +919876543210) "
            "or a 10-digit Indian mobile number."
        )
    return cleaned

# ============================================================
# Password Hashing (kept for existing admin accounts)
# ============================================================

def generate_salt() -> str:
    return secrets.token_hex(16)

def hash_password(password: str, salt: str) -> str:
    salted = f"{password}{salt}{SECRET_KEY}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()

def verify_password(plain_password: str, password_hash: str, salt: str) -> bool:
    return hash_password(plain_password, salt) == password_hash

# ============================================================
# JWT Access Tokens
# ============================================================

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def base64url_decode(encoded_str: str) -> bytes:
    padding = '=' * (4 - (len(encoded_str) % 4))
    return base64.urlsafe_b64decode(encoded_str + padding)

def create_access_token(user_id: int, email: str, role: str = "customer", expires_delta: Optional[timedelta] = None) -> str:
    header = {"alg": ALGORITHM, "typ": "JWT"}
    now = datetime.utcnow()
    expire = now + (expires_delta if expires_delta else timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))

    payload = {
        "sub": str(user_id),
        "email": email or "",
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }

    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))

    signature_base = f"{header_b64}.{payload_b64}"
    signature = hashlib.sha256(f"{signature_base}.{SECRET_KEY}".encode('utf-8')).hexdigest()

    return f"{signature_base}.{signature}"

def decode_access_token(token: str) -> Optional[dict]:
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

# ============================================================
# Stateless HMAC OTP Token (no DB storage)
# ============================================================

def _otp_hmac(phone: str, otp: str, expires_at: int) -> str:
    """Compute HMAC-SHA256 of phone|otp|expires_at using SECRET_KEY."""
    msg = f"{phone}|{otp}|{expires_at}".encode("utf-8")
    return hmac.new(SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()

def create_otp_token(phone: str, otp: str) -> str:
    """
    Create a stateless signed OTP token.
    Token encodes: phone, expiry timestamp, HMAC signature.
    The OTP itself is NOT embedded in the token (only its HMAC).
    Returns a base64url-encoded JSON string safe to send to the client.
    """
    expires_at = int(time.time()) + OTP_EXPIRE_SECONDS
    sig = _otp_hmac(phone, otp, expires_at)
    payload = json.dumps({"p": phone, "exp": expires_at, "sig": sig})
    return base64url_encode(payload.encode("utf-8"))

def verify_otp_token(phone: str, otp_code: str, token: str) -> None:
    """
    Verify OTP code against stateless HMAC token.
    Raises HTTPException on failure (expired, tampered, wrong OTP).
    Uses constant-time comparison to prevent timing attacks.
    """
    try:
        payload_bytes = base64url_decode(token)
        data = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid verification token. Please request a new OTP.")

    token_phone = data.get("p", "")
    expires_at = data.get("exp", 0)
    stored_sig = data.get("sig", "")

    # Expiry check
    if int(time.time()) > expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # Phone match (constant-time)
    if not secrets.compare_digest(token_phone, phone):
        raise HTTPException(status_code=400, detail="Invalid verification token.")

    # Attempt limit check
    _increment_attempt(token)

    # Recompute expected HMAC
    expected_sig = _otp_hmac(phone, otp_code, expires_at)

    # Constant-time comparison
    if not secrets.compare_digest(stored_sig, expected_sig):
        remaining = OTP_MAX_ATTEMPTS - _get_attempts(token)
        if remaining <= 0:
            raise HTTPException(
                status_code=429,
                detail="Too many incorrect attempts. Please request a new OTP."
            )
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect OTP code. {remaining} attempt(s) remaining."
        )

    # Valid — clear attempt counter
    _clear_attempts(token)

# ============================================================
# In-Memory Rate Limiter (thread-safe)
# ============================================================

_rate_lock = threading.Lock()
# phone -> list of unix timestamps when OTP was sent
_otp_send_times: dict[str, list[float]] = {}
# token_hash -> attempt count
_otp_attempts: dict[str, int] = {}

def _token_key(token: str) -> str:
    """Stable short key for attempt tracking."""
    return hashlib.sha256(token.encode()).hexdigest()[:32]

def check_rate_limit(phone: str) -> None:
    """Raise 429 if phone has requested too many OTPs in the rate window."""
    now = time.time()
    with _rate_lock:
        timestamps = _otp_send_times.get(phone, [])
        # Prune old entries outside window
        timestamps = [t for t in timestamps if now - t < OTP_RATE_LIMIT_WINDOW]
        if len(timestamps) >= OTP_RATE_LIMIT_COUNT:
            wait = int(OTP_RATE_LIMIT_WINDOW - (now - timestamps[0]))
            raise HTTPException(
                status_code=429,
                detail=f"Too many OTP requests. Please wait {wait} seconds before requesting again."
            )
        timestamps.append(now)
        _otp_send_times[phone] = timestamps

def _increment_attempt(token: str) -> None:
    key = _token_key(token)
    with _rate_lock:
        count = _otp_attempts.get(key, 0) + 1
        if count > OTP_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=429,
                detail="Too many incorrect attempts. Please request a new OTP."
            )
        _otp_attempts[key] = count

def _get_attempts(token: str) -> int:
    return _otp_attempts.get(_token_key(token), 0)

def _clear_attempts(token: str) -> None:
    key = _token_key(token)
    with _rate_lock:
        _otp_attempts.pop(key, None)

# ============================================================
# FastAPI Auth Dependencies
# ============================================================

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
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
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended.")

    return user

def get_current_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    user_id = int(payload.get("sub", 0))
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin user not found")
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account is suspended.")

    return user


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

def create_access_token(user_id: int, email: str, role: str = "customer", expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT token with role claim."""
    header = {"alg": ALGORITHM, "typ": "JWT"}
    now = datetime.utcnow()
    expire = now + (expires_delta if expires_delta else timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))

    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
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

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    """FastAPI dependency: authenticate any verified user (customer or admin)."""
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
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended.")

    return user

def get_current_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    """FastAPI dependency: authenticate admin users only."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    user_id = int(payload.get("sub", 0))
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin user not found")
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account is suspended.")

    return user
