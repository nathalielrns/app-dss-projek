from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import os

from backend.database import engine, get_db, Base
from backend import models, schemas
from backend.saw import hitung_saw
from backend.topsis import hitung_topsis

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DSS App - Sistem Pendukung Keputusan")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.post("/api/studi-kasus", response_model=schemas.StudiKasusDetailOut)
def buat_studi_kasus(data: schemas.StudiKasusCreate, db: Session = Depends(get_db)):
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
    studi = models.StudiKasus(nama=data.nama, deskripsi=data.deskripsi, metode=metode)
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

    return schemas.StudiKasusDetailOut(
        id=studi.id,
        nama=studi.nama,
        deskripsi=studi.deskripsi,
        metode=studi.metode,
        dibuat_pada=studi.dibuat_pada,
        hasil=sorted(
            [schemas.HasilOut(alternatif_nama=h.alternatif_nama, skor=h.skor, ranking=h.ranking) for h in hasil_objs],
            key=lambda h: h.ranking,
        ),
    )


@app.get("/api/studi-kasus", response_model=List[schemas.StudiKasusOut])
def daftar_studi_kasus(db: Session = Depends(get_db)):
    return db.query(models.StudiKasus).order_by(models.StudiKasus.dibuat_pada.desc()).all()


@app.get("/api/studi-kasus/{studi_id}", response_model=schemas.StudiKasusDetailOut)
def detail_studi_kasus(studi_id: int, db: Session = Depends(get_db)):
    studi = db.query(models.StudiKasus).filter(models.StudiKasus.id == studi_id).first()
    if not studi:
        raise HTTPException(status_code=404, detail="Studi kasus tidak ditemukan")
    hasil = sorted(
        [schemas.HasilOut(alternatif_nama=h.alternatif_nama, skor=h.skor, ranking=h.ranking) for h in studi.hasil],
        key=lambda h: h.ranking,
    )
    return schemas.StudiKasusDetailOut(
        id=studi.id, nama=studi.nama, deskripsi=studi.deskripsi,
        metode=studi.metode, dibuat_pada=studi.dibuat_pada, hasil=hasil,
    )


@app.delete("/api/studi-kasus/{studi_id}")
def hapus_studi_kasus(studi_id: int, db: Session = Depends(get_db)):
    studi = db.query(models.StudiKasus).filter(models.StudiKasus.id == studi_id).first()
    if not studi:
        raise HTTPException(status_code=404, detail="Studi kasus tidak ditemukan")
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
