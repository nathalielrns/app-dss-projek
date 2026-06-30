from fastapi import APIRouter

router = APIRouter(prefix="/auth/google", tags=["Google Login"])

@router.get("/login")
async def login_google():
    return {"status": "Google Login Router Berhasil"}
