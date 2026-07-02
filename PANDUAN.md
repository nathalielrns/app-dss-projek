# Panduan Setup — DSS App + Power BI

## Apa yang sudah dibuat
- **Backend** (Python/FastAPI): hitung SAW & TOPSIS, simpan ke database
- **Frontend** (HTML/JS): form input kriteria, alternatif, matriks nilai, hasil, riwayat
- **Database**: struktur generik (studi kasus → kriteria → alternatif → nilai → hasil)

Struktur ini dirancang supaya nanti metode lain (WP, AHP, dst) bisa ditambahkan tanpa ubah database.

---

## LANGKAH 1 — Coba dulu di komputer sendiri (opsional tapi disarankan)

Butuh Python 3.10+ terinstall.

```bash
cd dss-app
pip install -r requirements.txt
uvicorn backend.main:app --reload
```
(Dijalankan dari folder utama `dss-app`, BUKAN dari dalam folder `backend` — soalnya file-file backend saling import pakai `backend.xxx`.)

Buka browser ke `http://localhost:8000` — coba bikin studi kasus, lihat hasilnya muncul.
(Database otomatis pakai file `dss.db` lokal, tidak perlu setup apa-apa dulu.)

---

## LANGKAH 2 — Bikin database online (Supabase)

1. Daftar gratis di **supabase.com** → "New Project"
2. Tunggu project selesai dibuat (1-2 menit)
3. Masuk ke **Project Settings → Database → Connection string**
4. Pilih mode **"Session"** (bukan "Transaction"), copy connection string-nya. Bentuknya seperti:
   ```
   postgresql://postgres.xxxx:[PASSWORD]@aws-0-xxxx.pooler.supabase.com:5432/postgres
   ```
5. Ganti `[PASSWORD]` dengan password yang kamu set waktu bikin project.
6. Simpan string ini — nanti dipakai 2 kali: di Railway (langkah 3) dan di Power BI (langkah 5).

---

## LANGKAH 3 — Deploy web app ke Railway

1. Bikin akun gratis di **railway.app** (bisa login pakai GitHub)
2. Upload folder `dss-app` ke GitHub repo baru (lewat GitHub Desktop atau web upload, tidak perlu jago Git)
3. Di Railway: **New Project → Deploy from GitHub repo** → pilih repo kamu
4. Di tab **Variables**, tambahkan:
   - `DATABASE_URL` = connection string dari Supabase (langkah 2)
5. Di tab **Settings → Build**, set:
   - Root directory: (kosongkan / biarkan folder utama repo, JANGAN diisi `backend`)
   - Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
6. Railway akan kasih kamu URL publik, misal `https://dss-app-production.up.railway.app`
7. Buka URL itu di browser — kalau form muncul, berarti sukses online.

> Catatan: di `frontend/app.js` baris pertama ada `const API = "";` — biarkan kosong karena frontend dan backend di-serve dari domain yang sama oleh Railway.

---

## LANGKAH 4 — Tim pakai bareng

Tim kamu cukup buka URL Railway itu dari browser manapun (HP/laptop), input data lewat form, hasilnya otomatis tersimpan di Supabase. Tidak perlu install apa-apa.

---

## LANGKAH 5 — Sambungkan ke Power BI

1. Install **Power BI Desktop** (gratis, dari Microsoft Store / situs resmi)
2. Buka Power BI Desktop → **Get Data → PostgreSQL database**
3. Masukkan **Server** dan **Database** dari connection string Supabase kamu, contoh:
   - Server: `aws-0-xxxx.pooler.supabase.com:5432`
   - Database: `postgres`
4. Pilih mode **Import** (lebih cepat) atau **DirectQuery** (data selalu real-time tapi lebih berat)
5. Masukkan username (`postgres.xxxx`) dan password Supabase kamu
6. Power BI akan menampilkan daftar tabel — pilih terutama tabel **`hasil`** (ini hasil ranking akhir yang paling relevan untuk dashboard), boleh juga `studi_kasus`, `kriteria`, `alternatif`
7. Klik **Load** → mulai bikin visualisasi: bar chart ranking, tabel skor, dst
8. Kalau mau data auto-refresh: publish ke **Power BI Service** → set **Scheduled Refresh** (karena database online, tidak perlu gateway tambahan)

---

## Kalau ada error
- **"relation does not exist"** di Power BI → pastikan kamu sudah pernah submit minimal 1 studi kasus lewat web app dulu, supaya tabelnya terbentuk
- **Connection refused** dari Railway ke Supabase → cek lagi password & connection string-nya, jangan ada spasi tersisa
- **CORS error** di browser → seharusnya tidak terjadi karena frontend & backend satu domain di Railway, tapi kalau muncul, kabari aku ya

---

## Rencana lanjutan (Fase 2)
Setelah ini jalan, kita bisa tambah:
- Metode WP (Weighted Product) dan AHP
- Halaman edit/hapus kriteria & alternatif
- Export ke Excel langsung dari web app

Tinggal bilang aja kalau sudah siap lanjut.
