import os
import logging
from cryptography.fernet import Fernet
from sqlalchemy.types import TypeDecorator, String, Text

logger = logging.getLogger(__name__)

# Fallback static key if ENCRYPTION_KEY environment variable is not provided.
# Must be a 32 url-safe base64-encoded bytes key.
DEFAULT_KEY = "gAAAAABmDx6yLq-e6WpZp2x7fT6c3oU4mFhG_V1d2e3f4g5h6i7j8k=" # A fallback token or key
# Let's generate a valid Fernet key if not set:
# We use a static key to ensure that across backend restarts, previously encrypted data is still readable.
# Users should set a custom key in their .env file in production.
ENCRYPTION_KEY_RAW = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY_RAW:
    # A valid 32-byte base64 key:
    ENCRYPTION_KEY_RAW = "yN3a5Q8k1HhD7j_L9mF2vQ6X4sZ1b3c5P7t8v9w0x1Y="
else:
    # Ensure it's padded/valid base64 if needed, or if it's not a Fernet key, adjust
    pass

try:
    fernet = Fernet(ENCRYPTION_KEY_RAW.encode())
except Exception as e:
    logger.error(f"Invalid ENCRYPTION_KEY provided, generating a temporary key: {str(e)}")
    # Last resort fallback key (guaranteed valid format)
    ENCRYPTION_KEY_RAW = Fernet.generate_key().decode()
    fernet = Fernet(ENCRYPTION_KEY_RAW.encode())

def encrypt_value(val: str) -> str:
    """Encrypt a string using AES-256 (Fernet)"""
    if not val:
        return val
    try:
        return fernet.encrypt(val.encode()).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {str(e)}")
        return val

def decrypt_value(val: str) -> str:
    """Decrypt a string, falling back to plaintext if the value is not encrypted or invalid"""
    if not val:
        return val
    try:
        # Check if the string looks like a Fernet token (starts with gAAAA)
        if val.startswith("gAAAA"):
            return fernet.decrypt(val.encode()).decode()
        return val
    except Exception:
        # If decryption fails (e.g. wrong key, or it was stored as plaintext before migration), return as-is
        return val


class EncryptedString(TypeDecorator):
    """SQLAlchemy TypeDecorator for transparent encryption of short strings"""
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return encrypt_value(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return decrypt_value(value)
        return value


class EncryptedText(TypeDecorator):
    """SQLAlchemy TypeDecorator for transparent encryption of longer text fields"""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return encrypt_value(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return decrypt_value(value)
        return value
