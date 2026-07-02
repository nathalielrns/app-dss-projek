from fastapi import FastAPI, Depends, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from backend.auth.google import router as google_router
from backend.auth.microsoft import router as microsoft_router
from backend.auth.aouth import google_configured, microsoft_configured
import os

from backend.database import engine, get_db, Base
from backend import models, schemas
from backend.saw import hitung_saw
from backend.topsis import hitung_topsis

Base.metadata.create_all(bind=engine)

# --- Migrasi ringan: tambah kolom device_id kalau belum ada (SQLite/Postgres lama) ---
with engine.connect() as conn:
    try:
        cols = [r[1] for r in conn.execute(text("PRAGMA table_info(studi_kasus)"))]
        is_sqlite = engine.url.get_backend_name() == "sqlite"
    except Exception:
        cols, is_sqlite = [], False
    if is_sqlite and cols and "device_id" not in cols:
        conn.execute(text("ALTER TABLE studi_kasus ADD COLUMN device_id VARCHAR(64)"))
        conn.commit()
    elif not is_sqlite:
        # Postgres: aman dipanggil berkali-kali karena pakai IF NOT EXISTS
        try:
            conn.execute(text("ALTER TABLE studi_kasus ADD COLUMN IF NOT EXISTS device_id VARCHAR(64)"))
            conn.commit()
        except Exception:
            pass

SECRET_KEY = os.getenv("SECRET_KEY", "ganti_secret_key_ini_di_env")

app = FastAPI(title="DSS App - Sistem Pendukung Keputusan")

# Session diperlukan Authlib untuk menyimpan "state" OAuth & data user yang login.
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY, same_site="lax")

app.include_router(google_router)
app.include_router(microsoft_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_device_id(x_device_id: Optional[str] = Header(default=None)) -> Optional[str]:
    """Header X-Device-Id dikirim frontend (UUID random tersimpan di localStorage tiap
    browser/device). Kalau tidak dikirim (misal Power BI Desktop connect langsung ke
    /api/studi-kasus), endpoint akan menampilkan SEMUA data (mode 'global read')."""
    return x_device_id


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


# --- AUTH STATUS ---
@app.get("/auth/me")
def auth_me(request: Request):
    user = request.session.get("user")
    if not user:
        return {"logged_in": False}
    return {"logged_in": True, **user, "pbi_connected": bool(request.session.get("pbi_connected"))}


@app.get("/auth/config-status")
def auth_config_status():
    """Dipakai frontend buat kasih tau kalau kredensial OAuth belum diisi di .env."""
    return {"google": google_configured(), "microsoft": microsoft_configured()}


@app.post("/auth/logout")
def auth_logout(request: Request):
    request.session.clear()
    return {"status": "logged_out"}


@app.post("/api/studi-kasus", response_model=schemas.StudiKasusDetailOut)
def buat_studi_kasus(
    data: schemas.StudiKasusCreate,
    db: Session = Depends(get_db),
    device_id: Optional[str] = Depends(get_device_id),
):
    metode = data.metode.upper()
    if metode not in ("SAW", "TOPSIS"):
        raise HTTPException(status_code=400, detail="Metode harus SAW atau TOPSIS")

    if len(data.kriteria) == 0 or len(data.alternatif) == 0:
        raise HTTPException(status_code=400, detail="Kriteria dan alternatif tidak boleh kosong")

    total_bobot = sum(k.bobot for k in data.kriteria)
    if abs(total_bobot - 1.0) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Total bobot kriteria harus = 1.0 (saat ini {total_bobot})",
        )

    # 1. Simpan studi kasus
    studi = models.StudiKasus(nama=data.nama, deskripsi=data.deskripsi, metode=metode, device_id=device_id)
    db.add(studi)
    db.flush()  # supaya studi.id terisi

    # 2. Simpan kriteria
    kriteria_objs = []
    for k in data.kriteria:
        obj = models.Kriteria(studi_kasus_id=studi.id, nama=k.nama, bobot=k.bobot, tipe=k.tipe)
        db.add(obj)
        kriteria_objs.append(obj)
    db.flush()

    # 3. Simpan alternatif
    alternatif_objs = []
    for a in data.alternatif:
        obj = models.Alternatif(studi_kasus_id=studi.id, nama=a.nama)
        db.add(obj)
        alternatif_objs.append(obj)
    db.flush()

    # 4. Bangun matriks nilai (baris=alternatif, kolom=kriteria) & simpan tiap sel
    jumlah_alt = len(alternatif_objs)
    jumlah_krit = len(kriteria_objs)
    matriks = [[0.0] * jumlah_krit for _ in range(jumlah_alt)]

    for n in data.matriks:
        if not (0 <= n.alternatif_index < jumlah_alt) or not (0 <= n.kriteria_index < jumlah_krit):
            raise HTTPException(status_code=400, detail="Index alternatif/kriteria di luar batas")
        matriks[n.alternatif_index][n.kriteria_index] = n.nilai
        db.add(models.Nilai(
            studi_kasus_id=studi.id,
            alternatif_id=alternatif_objs[n.alternatif_index].id,
            kriteria_id=kriteria_objs[n.kriteria_index].id,
            nilai=n.nilai,
        ))

    # 5. Hitung sesuai metode
    kriteria_dict = [{"bobot": k.bobot, "tipe": k.tipe} for k in data.kriteria]
    if metode == "SAW":
        skor_list = hitung_saw(matriks, kriteria_dict)
    else:
        skor_list = hitung_topsis(matriks, kriteria_dict)

    # 6. Ranking (skor lebih besar = lebih baik, untuk SAW & TOPSIS)
    urutan = sorted(range(jumlah_alt), key=lambda i: skor_list[i], reverse=True)
    ranking_per_alt = {}
    for posisi, idx in enumerate(urutan, start=1):
        ranking_per_alt[idx] = posisi

    # 7. Simpan hasil
    hasil_objs = []
    for i in range(jumlah_alt):
        h = models.Hasil(
            studi_kasus_id=studi.id,
            alternatif_id=alternatif_objs[i].id,
            alternatif_nama=alternatif_objs[i].nama,
            skor=round(skor_list[i], 6),
            ranking=ranking_per_alt[i],
            metode=metode,
        )
        db.add(h)
        hasil_objs.append(h)

    db.commit()
    db.refresh(studi)

    return _build_detail(studi, hasil_objs, kriteria_objs, alternatif_objs, data.matriks)


def _build_detail(studi, hasil_objs, kriteria_objs, alternatif_objs, matriks_in):
    return schemas.StudiKasusDetailOut(
        id=studi.id,
        nama=studi.nama,
        deskripsi=studi.deskripsi,
        metode=studi.metode,
        dibuat_pada=studi.dibuat_pada,
        device_id=studi.device_id,
        hasil=sorted(
            [schemas.HasilOut(alternatif_nama=h.alternatif_nama, skor=h.skor, ranking=h.ranking) for h in hasil_objs],
            key=lambda h: h.ranking,
        ),
        kriteria=[schemas.KriteriaOut(nama=k.nama, bobot=k.bobot, tipe=k.tipe) for k in kriteria_objs],
        alternatif=[schemas.AlternatifOut(nama=a.nama) for a in alternatif_objs],
        nilai=[schemas.NilaiOut(alternatif_index=n.alternatif_index, kriteria_index=n.kriteria_index, nilai=n.nilai) for n in matriks_in],
    )


@app.get("/api/studi-kasus", response_model=List[schemas.StudiKasusOut])
def daftar_studi_kasus(db: Session = Depends(get_db), device_id: Optional[str] = Depends(get_device_id)):
    q = db.query(models.StudiKasus)
    if device_id:
        q = q.filter(models.StudiKasus.device_id == device_id)
    return q.order_by(models.StudiKasus.dibuat_pada.desc()).all()


@app.get("/api/studi-kasus/{studi_id}", response_model=schemas.StudiKasusDetailOut)
def detail_studi_kasus(studi_id: int, db: Session = Depends(get_db), device_id: Optional[str] = Depends(get_device_id)):
    studi = db.query(models.StudiKasus).filter(models.StudiKasus.id == studi_id).first()
    if not studi:
        raise HTTPException(status_code=404, detail="Studi kasus tidak ditemukan")
    if device_id and studi.device_id and studi.device_id != device_id:
        raise HTTPException(status_code=403, detail="Studi kasus ini milik device lain")

    hasil = sorted(
        [schemas.HasilOut(alternatif_nama=h.alternatif_nama, skor=h.skor, ranking=h.ranking) for h in studi.hasil],
        key=lambda h: h.ranking,
    )
    kriteria_sorted = sorted(studi.kriteria, key=lambda k: k.id)
    alternatif_sorted = sorted(studi.alternatif, key=lambda a: a.id)
    alt_index = {a.id: i for i, a in enumerate(alternatif_sorted)}
    krit_index = {k.id: i for i, k in enumerate(kriteria_sorted)}
    nilai_out = [
        schemas.NilaiOut(
            alternatif_index=alt_index[n.alternatif_id],
            kriteria_index=krit_index[n.kriteria_id],
            nilai=n.nilai,
        )
        for n in studi.nilai
    ]
    return schemas.StudiKasusDetailOut(
        id=studi.id, nama=studi.nama, deskripsi=studi.deskripsi,
        metode=studi.metode, dibuat_pada=studi.dibuat_pada, device_id=studi.device_id,
        hasil=hasil,
        kriteria=[schemas.KriteriaOut(nama=k.nama, bobot=k.bobot, tipe=k.tipe) for k in kriteria_sorted],
        alternatif=[schemas.AlternatifOut(nama=a.nama) for a in alternatif_sorted],
        nilai=nilai_out,
    )


@app.delete("/api/studi-kasus/{studi_id}")
def hapus_studi_kasus(studi_id: int, db: Session = Depends(get_db), device_id: Optional[str] = Depends(get_device_id)):
    studi = db.query(models.StudiKasus).filter(models.StudiKasus.id == studi_id).first()
    if not studi:
        raise HTTPException(status_code=404, detail="Studi kasus tidak ditemukan")
    if device_id and studi.device_id and studi.device_id != device_id:
        raise HTTPException(status_code=403, detail="Studi kasus ini milik device lain")
    db.delete(studi)
    db.commit()
    return {"status": "dihapus"}


# --- Serve frontend (file statis) ---
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
