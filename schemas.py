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


class StudiKasusOut(BaseModel):
    id: int
    nama: str
    deskripsi: Optional[str]
    metode: str
    dibuat_pada: datetime

    class Config:
        from_attributes = True


class StudiKasusDetailOut(StudiKasusOut):
    hasil: List[HasilOut]
