from fastapi import APIRouter, Request
from starlette.responses import RedirectResponse
from backend.auth.aouth import oauth, microsoft_configured

router = APIRouter(prefix="/auth/microsoft", tags=["Microsoft Login"])


@router.get("/login")
async def login_microsoft(request: Request):
    if not microsoft_configured():
        return RedirectResponse(
            url="/?login_error=" + "Microsoft+belum+dikonfigurasi.+Isi+MICROSOFT_CLIENT_ID+%26+MICROSOFT_CLIENT_SECRET+di+.env"
        )
    redirect_uri = "https://dssapp.up.railway.app/auth/google/callback"
    return await oauth.microsoft.authorize_redirect(request, redirect_uri)


@router.get("/callback", name="auth_microsoft_callback")
async def auth_microsoft_callback(request: Request):
    try:
        token = await oauth.microsoft.authorize_access_token(request)
        userinfo = token.get("userinfo") or await oauth.microsoft.userinfo(token=token)
    except Exception as e:
        return RedirectResponse(url=f"/?login_error=Microsoft+gagal:+{e}")

    request.session["user"] = {
        "name": userinfo.get("name") or userinfo.get("email"),
        "email": userinfo.get("email") or userinfo.get("preferred_username"),
        "picture": None,
        "provider": "microsoft",
    }
    # Microsoft login otomatis dianggap "terhubung Power BI" (dipakai fitur push di tab Export)
    request.session["pbi_connected"] = True
    return RedirectResponse(url="/?login_success=microsoft")
