from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base


class StudiKasus(Base):
    """Satu 'project' DSS, misal: 'Pemilihan Karyawan Terbaik Q2 2026'"""
    __tablename__ = "studi_kasus"

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(255), nullable=False)
    deskripsi = Column(Text, nullable=True)
    metode = Column(String(50), nullable=False)  # "SAW" atau "TOPSIS"
    dibuat_pada = Column(DateTime, default=datetime.utcnow)
    # ID unik per-device (dibuat & disimpan browser di localStorage). Dipakai supaya
    # tiap device/browser hanya melihat riwayat studi kasus miliknya sendiri.
    device_id = Column(String(64), nullable=True, index=True)

    kriteria = relationship("Kriteria", back_populates="studi_kasus", cascade="all, delete-orphan")
    alternatif = relationship("Alternatif", back_populates="studi_kasus", cascade="all, delete-orphan")
    nilai = relationship("Nilai", back_populates="studi_kasus", cascade="all, delete-orphan")
    hasil = relationship("Hasil", back_populates="studi_kasus", cascade="all, delete-orphan")


class Kriteria(Base):
    """Kriteria penilaian, misal: 'Kedisiplinan', bobot 0.3, tipe benefit"""
    __tablename__ = "kriteria"

    id = Column(Integer, primary_key=True, index=True)
    studi_kasus_id = Column(Integer, ForeignKey("studi_kasus.id"), nullable=False)
    nama = Column(String(255), nullable=False)
    bobot = Column(Float, nullable=False)
    tipe = Column(String(10), nullable=False)  # "benefit" atau "cost"

    studi_kasus = relationship("StudiKasus", back_populates="kriteria")


class Alternatif(Base):
    """Alternatif yang dinilai, misal: 'Budi', 'Siti', dst"""
    __tablename__ = "alternatif"

    id = Column(Integer, primary_key=True, index=True)
    studi_kasus_id = Column(Integer, ForeignKey("studi_kasus.id"), nullable=False)
    nama = Column(String(255), nullable=False)

    studi_kasus = relationship("StudiKasus", back_populates="alternatif")


class Nilai(Base):
    """Sel matriks keputusan: nilai alternatif X pada kriteria Y"""
    __tablename__ = "nilai"

    id = Column(Integer, primary_key=True, index=True)
    studi_kasus_id = Column(Integer, ForeignKey("studi_kasus.id"), nullable=False)
    alternatif_id = Column(Integer, ForeignKey("alternatif.id"), nullable=False)
    kriteria_id = Column(Integer, ForeignKey("kriteria.id"), nullable=False)
    nilai = Column(Float, nullable=False)

    studi_kasus = relationship("StudiKasus", back_populates="nilai")


class Hasil(Base):
    """Hasil akhir perhitungan: skor & ranking per alternatif. Inilah yang dibaca Power BI."""
    __tablename__ = "hasil"

    id = Column(Integer, primary_key=True, index=True)
    studi_kasus_id = Column(Integer, ForeignKey("studi_kasus.id"), nullable=False)
    alternatif_id = Column(Integer, ForeignKey("alternatif.id"), nullable=False)
    alternatif_nama = Column(String(255), nullable=False)
    skor = Column(Float, nullable=False)
    ranking = Column(Integer, nullable=False)
    metode = Column(String(50), nullable=False)
    dihitung_pada = Column(DateTime, default=datetime.utcnow)

    studi_kasus = relationship("StudiKasus", back_populates="hasil")
