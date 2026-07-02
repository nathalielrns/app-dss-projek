# Panduan Setup — Login Google & Microsoft Asli

Sebelumnya tombol "Login Google" / "Login Microsoft" itu cuma simulasi (`prompt()`
browser). Sekarang sudah diganti jadi login OAuth **beneran** — pengguna akan
diarahkan ke halaman login Google/Microsoft asli, lalu balik lagi ke Ado's BI
dalam keadaan sudah login.

Supaya ini jalan, kamu perlu daftarin aplikasi ke Google Cloud Console dan Azure
Portal, lalu isi 4 nilai rahasia di file `.env`. Ini satu-satunya bagian yang
butuh setup manual — semua kode-nya sudah jadi.

---

## Ringkasan yang perlu diisi di `.env`

```
SECRET_KEY=...                  (boleh isi string acak apa saja)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common      (biarkan "common" kecuali mau dibatasi 1 organisasi)
```

Kalau salah satu (Google/Microsoft) belum diisi, tombol login provider itu tetap
muncul tapi akan kasih pesan error yang jelas waktu diklik — bukan crash. Jadi
kamu bisa setup salah satu dulu kalau mau.

---

## BAGIAN A — Setup Google Login

1. Buka **console.cloud.google.com** → login pakai akun Google kamu.
2. Bikin project baru (atau pakai project yang sudah ada): klik dropdown nama
   project di kiri atas → **New Project** → kasih nama misal `Ado's BI` → **Create**.
3. Di search bar atas, cari **"OAuth consent screen"** → buka.
   - Pilih **External** (kecuali kamu punya Google Workspace organisasi) → **Create**.
   - Isi **App name**: `Ado's BI`, **User support email**: email kamu, **Developer
     contact**: email kamu → **Save and Continue** terus sampai selesai.
   - Di step **"Test users"** (kalau app masih status "Testing"), tambahkan email
     Google yang akan dipakai untuk login/testing.
4. Cari **"Credentials"** di search bar → buka.
5. Klik **+ Create Credentials → OAuth client ID**.
   - **Application type**: `Web application`
   - **Name**: bebas, misal `Ado's BI Web`
   - **Authorized redirect URIs** → klik **+ Add URI**, isi (WAJIB persis sama, termasuk `/auth/google/callback`):
     - Untuk coba di komputer sendiri: `http://localhost:8000/auth/google/callback`
     - Untuk yang sudah online di Railway: `https://NAMA-APP-KAMU.up.railway.app/auth/google/callback`
   - Klik **Create**.
6. Muncul popup berisi **Client ID** dan **Client Secret** — copy keduanya.
7. Buka file `.env`, isi:
   ```
   GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxx
   ```

> Kalau nanti ganti URL Railway atau mau tambah domain lain, balik lagi ke
> **Credentials → (klik OAuth client-nya) → tambahkan URI baru di Authorized
> redirect URIs**, jangan hapus yang lama kalau masih dipakai.

---

## BAGIAN B — Setup Microsoft Login

1. Buka **portal.azure.com** → login pakai akun Microsoft kamu (akun pribadi
   Outlook/Hotmail juga bisa, gratis).
2. Cari **"App registrations"** di search bar atas → buka → **+ New registration**.
3. Isi:
   - **Name**: `Ado's BI`
   - **Supported account types**: pilih **"Accounts in any organizational
     directory and personal Microsoft accounts"** (ini yang bikin akun pribadi
     & akun kerja/sekolah dua-duanya bisa login)
   - **Redirect URI**: pilih tipe **Web**, isi:
     - Untuk coba di komputer sendiri: `http://localhost:8000/auth/microsoft/callback`
     - Untuk yang sudah online: `https://NAMA-APP-KAMU.up.railway.app/auth/microsoft/callback`
   - Klik **Register**.
4. Di halaman **Overview** app yang baru dibuat, copy **Application (client) ID**.
5. Di menu kiri, klik **Certificates & secrets** → tab **Client secrets** →
   **+ New client secret** → kasih deskripsi bebas → **Add**.
   - Copy nilai **Value** (bukan Secret ID) segera setelah dibuat — nilai ini
     cuma ditampilkan sekali.
6. Buka file `.env`, isi:
   ```
   MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   MICROSOFT_CLIENT_SECRET=nilai-Value-yang-tadi-di-copy
   MICROSOFT_TENANT_ID=common
   ```

---

## BAGIAN C — Kalau sudah online di Railway

Variable `.env` di komputer kamu **tidak otomatis** kebawa ke Railway. Harus
diisi manual juga di sana:

1. Buka project kamu di **railway.app** → tab **Variables**.
2. Tambahkan satu-satu: `SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`
   (sama seperti isi `.env` lokal).
3. Pastikan juga redirect URI yang kamu daftarkan di Google Cloud Console &
   Azure sudah pakai domain Railway yang benar (lihat Bagian A langkah 5 & B
   langkah 3), bukan `localhost`.
4. Railway akan otomatis restart aplikasi setelah variable ditambahkan.

---

## Cara coba

1. Jalankan aplikasi (`uvicorn backend.main:app --reload` dari folder utama, atau buka
   URL Railway-nya).
2. Klik ikon profil di sidebar → **Login dengan Google** atau **Login dengan Microsoft**.
3. Browser akan pindah ke halaman login asli Google/Microsoft.
4. Setelah berhasil login & izinkan akses, otomatis balik ke Ado's BI dalam
   keadaan sudah login (nama & foto profil muncul).
5. Login dengan Microsoft otomatis dianggap "terhubung ke Power BI" (dipakai di
   tab Export → fitur push data).
6. Login akan tetap tersimpan walau halaman di-refresh, sampai kamu klik Logout.

---

## Kalau error

- **"Google belum dikonfigurasi..."** / **"Microsoft belum dikonfigurasi..."**
  saat klik tombol login → berarti `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
  (atau versi Microsoft-nya) masih kosong di `.env`.
- **`redirect_uri_mismatch`** dari Google, atau **`AADSTS50011`** dari
  Microsoft → URL redirect di `.env`/Railway tidak persis sama dengan yang
  didaftarkan di Google Cloud Console / Azure. Cek lagi huruf besar-kecil,
  `http` vs `https`, dan pastikan diakhiri `/auth/google/callback` atau
  `/auth/microsoft/callback`.
- **Login sukses tapi balik lagi jadi logged-out setelah refresh** → cek
  `SECRET_KEY` di `.env` sudah diisi (jangan dikosongkan), dan kalau di Railway
  pastikan variable-nya juga sudah diisi di sana (lihat Bagian C).

---

## Bonus yang sekalian dibenahi

- **Riwayat per-device**: tiap browser/HP sekarang otomatis dapat ID unik
  tersimpan di `localStorage`, dan riwayat studi kasus yang tampil di sidebar
  cuma punya device itu sendiri — device lain nggak akan ikut kecampur. Kalau
  suatu saat Power BI Desktop connect langsung ke database (bukan lewat web
  app), dia tetap bisa lihat SEMUA data seperti biasa (karena Power BI Desktop
  tidak mengirim ID device).
- **Fitur What-If**: sebelumnya nggak bisa dipakai karena backend belum pernah
  mengirim data kriteria/alternatif/matriks nilai ke frontend (cuma kirim hasil
  akhirnya saja) — jadi slider What-If tidak ada bahan untuk dihitung ulang.
  Sudah diperbaiki di `backend/schemas.py` & `backend/main.py`, sekarang detail
  studi kasus ikut membawa data itu.
