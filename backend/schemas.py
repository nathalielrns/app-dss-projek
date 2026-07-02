from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class KriteriaIn(BaseModel):
    nama: str
    bobot: float
    tipe: str  # "benefit" atau "cost"


class AlternatifIn(BaseModel):
    nama: str


class NilaiIn(BaseModel):
    alternatif_index: int  # posisi di list alternatif (0,1,2,...)
    kriteria_index: int    # posisi di list kriteria (0,1,2,...)
    nilai: float


class StudiKasusCreate(BaseModel):
    nama: str
    deskripsi: Optional[str] = None
    metode: str  # "SAW" atau "TOPSIS"
    kriteria: List[KriteriaIn]
    alternatif: List[AlternatifIn]
    matriks: List[NilaiIn]


class HasilOut(BaseModel):
    alternatif_nama: str
    skor: float
    ranking: int

    class Config:
        from_attributes = True


class KriteriaOut(BaseModel):
    nama: str
    bobot: float
    tipe: str

    class Config:
        from_attributes = True


class AlternatifOut(BaseModel):
    nama: str

    class Config:
        from_attributes = True


class NilaiOut(BaseModel):
    alternatif_index: int
    kriteria_index: int
    nilai: float

    class Config:
        from_attributes = True


class StudiKasusOut(BaseModel):
    id: int
    nama: str
    deskripsi: Optional[str]
    metode: str
    dibuat_pada: datetime
    device_id: Optional[str] = None

    class Config:
        from_attributes = True


class StudiKasusDetailOut(StudiKasusOut):
    hasil: List[HasilOut]
    # Ditambahkan supaya fitur What-If Analysis (butuh bobot & tipe tiap
    # kriteria, nama alternatif, dan matriks nilai asli) bisa jalan di frontend.
    # Sebelumnya field ini TIDAK ada di response -> itu sebabnya What-If gagal.
    kriteria: List[KriteriaOut] = []
    alternatif: List[AlternatifOut] = []
    nilai: List[NilaiOut] = []
