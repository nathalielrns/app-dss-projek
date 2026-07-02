"""
Registrasi OAuth client untuk Google & Microsoft pakai Authlib.
Kredensial diambil dari environment variable (.env). Kalau kosong,
login akan gagal dengan pesan jelas (lihat PANDUAN_LOGIN.md).
"""
from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv
import os

load_dotenv()

oauth = OAuth()

oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid email profile"
    },
)

# Microsoft (Azure AD / Entra ID) - dukung akun pribadi & kerja/sekolah
MICROSOFT_TENANT_ID = os.getenv("MICROSOFT_TENANT_ID", "common")
oauth.register(
    name="microsoft",
    client_id=os.getenv("MICROSOFT_CLIENT_ID"),
    client_secret=os.getenv("MICROSOFT_CLIENT_SECRET"),
    server_metadata_url=f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/v2.0/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid email profile User.Read"
    },
)


def google_configured() -> bool:
    return bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"))


def microsoft_configured() -> bool:
    return bool(os.getenv("MICROSOFT_CLIENT_ID") and os.getenv("MICROSOFT_CLIENT_SECRET"))
