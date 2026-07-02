from fastapi import APIRouter, Request
from starlette.responses import RedirectResponse
from backend.auth.aouth import oauth, google_configured

router = APIRouter(prefix="/auth/google", tags=["Google Login"])


@router.get("/login")
async def login_google(request: Request):
    if not google_configured():
        return RedirectResponse(
            url="/?login_error=Google+belum+dikonfigurasi."
        )

    redirect_uri = "https://dssapp.up.railway.app/auth/google/callback"

    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback", name="auth_google_callback")
async def auth_google_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        userinfo = token.get("userinfo") or await oauth.google.userinfo(token=token)
    except Exception as e:
        return RedirectResponse(url=f"/?login_error=Google+gagal:+{e}")

    request.session["user"] = {
        "name": userinfo.get("name") or userinfo.get("email"),
        "email": userinfo.get("email"),
        "picture": userinfo.get("picture"),
        "provider": "google",
    }
    return RedirectResponse(url="/?login_success=google")
