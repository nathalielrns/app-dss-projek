/* =====================================================
   DSS App — app.js
   Dark theme upgrade + Export CSV/JSON + Power BI push
   ===================================================== */

const API = ""; // kosongkan kalau frontend & backend satu domain (Railway)

// ---------- STATE ----------
let kriteriaList = [];
let alternatifList = [];
let matriksNilai = {};
let lastHasilData = null;      // hasil terakhir untuk export
let lastRiwayatData = null;    // riwayat detail terakhir untuk export
let currentUser = null;        // { name, email, provider }
let pbiAccessToken = null;     // Microsoft access token untuk Power BI

// ---------- TOAST ----------
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + type;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

// ---------- SERVER STATUS ----------
async function checkServer() {
  try {
    const res = await fetch(`${API}/api/health`);
    const ok = res.ok;
    document.getElementById("status-dot").className = ok ? "status-dot" : "status-dot offline";
    document.getElementById("status-dot").title = ok ? "Server terhubung" : "Server tidak merespons";
  } catch {
    document.getElementById("status-dot").className = "status-dot offline";
  }
}
checkServer();
setInterval(checkServer, 30000);

// ---------- SIDEBAR & TAB ----------
const sidebarEl = document.getElementById("sidebar");
document.getElementById("sidebar-toggle").addEventListener("click", () => {
  sidebarEl.classList.toggle("open");
});

const TAB_TITLES = {
  baru: "Studi Kasus Baru",
  riwayat: "Riwayat",
  export: "Export & Power BI",
};

document.querySelectorAll(".nav-item[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item[data-tab]").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-" + tab).classList.add("active");
    document.getElementById("topbar-title").textContent = TAB_TITLES[tab] || tab;
    if (tab === "riwayat") muatRiwayat();
    if (tab === "export") updateApiUrlDisplay();
    // Close sidebar on mobile
    if (window.innerWidth <= 768) sidebarEl.classList.remove("open");
  });
});

function updateApiUrlDisplay() {
  const el = document.getElementById("api-url-display");
  if (el) el.textContent = window.location.origin + "/api/studi-kasus";
}

// ---------- KRITERIA ----------
function renderKriteria() {
  const tbody = document.querySelector("#tabel-kriteria tbody");
  tbody.innerHTML = "";
  kriteriaList.forEach((k, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" value="${k.nama}" data-i="${i}" data-f="nama" class="kr-input" placeholder="Nama kriteria"></td>
      <td><input type="number" step="0.01" min="0" max="1" value="${k.bobot}" data-i="${i}" data-f="bobot" class="kr-input"></td>
      <td>
        <select data-i="${i}" data-f="tipe" class="kr-input">
          <option value="benefit" ${k.tipe === "benefit" ? "selected" : ""}>Benefit — semakin besar semakin baik</option>
          <option value="cost" ${k.tipe === "cost" ? "selected" : ""}>Cost — semakin kecil semakin baik</option>
        </select>
      </td>
      <td><button class="btn-remove" data-i="${i}" data-action="remove-kriteria">Hapus</button></td>
    `;
    tbody.appendChild(tr);
  });
  updateBobotBar();
  renderMatriks();
}

function updateBobotBar() {
  const total = kriteriaList.reduce((s, k) => s + (parseFloat(k.bobot) || 0), 0);
  const pct = Math.min(total * 100, 100);
  const fill = document.getElementById("bobot-bar-fill");
  const valEl = document.getElementById("total-bobot");
  fill.style.width = pct + "%";
  valEl.textContent = total.toFixed(2);

  const isGood = Math.abs(total - 1.0) < 0.01;
  const isOver = total > 1.01;
  fill.className = "bobot-bar-fill" + (isGood ? " good" : isOver ? " over" : "");
  valEl.className = "bobot-value" + (isGood ? " good" : isOver ? " over" : "");
}

document.getElementById("btn-tambah-kriteria").addEventListener("click", () => {
  kriteriaList.push({ nama: "", bobot: 0, tipe: "benefit" });
  renderKriteria();
});

document.querySelector("#tabel-kriteria tbody").addEventListener("input", (e) => {
  const i = e.target.dataset.i, f = e.target.dataset.f;
  if (i === undefined) return;
  kriteriaList[i][f] = f === "bobot" ? parseFloat(e.target.value) || 0 : e.target.value;
  if (f === "bobot") updateBobotBar();
  if (f === "nama") renderMatriks();
});

document.querySelector("#tabel-kriteria tbody").addEventListener("click", (e) => {
  if (e.target.dataset.action === "remove-kriteria") {
    kriteriaList.splice(e.target.dataset.i, 1);
    renderKriteria();
  }
});

// ---------- ALTERNATIF ----------
function renderAlternatif() {
  const tbody = document.querySelector("#tabel-alternatif tbody");
  tbody.innerHTML = "";
  alternatifList.forEach((a, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" value="${a.nama}" data-i="${i}" class="alt-input" placeholder="Nama alternatif"></td>
      <td><button class="btn-remove" data-i="${i}" data-action="remove-alternatif">Hapus</button></td>
    `;
    tbody.appendChild(tr);
  });
  renderMatriks();
}

document.getElementById("btn-tambah-alternatif").addEventListener("click", () => {
  alternatifList.push({ nama: "" });
  renderAlternatif();
});

document.querySelector("#tabel-alternatif tbody").addEventListener("input", (e) => {
  const i = e.target.dataset.i;
  if (i === undefined) return;
  alternatifList[i].nama = e.target.value;
  renderMatriks();
});

document.querySelector("#tabel-alternatif tbody").addEventListener("click", (e) => {
  if (e.target.dataset.action === "remove-alternatif") {
    alternatifList.splice(e.target.dataset.i, 1);
    renderAlternatif();
  }
});

// ---------- MATRIKS ----------
function renderMatriks() {
  const wrapper = document.getElementById("matriks-wrapper");
  if (kriteriaList.length === 0 || alternatifList.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
          <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
        <p>Isi kriteria dan alternatif terlebih dahulu</p>
      </div>`;
    return;
  }
  let html = '<table class="grid-table"><thead><tr><th>Alternatif</th>';
  kriteriaList.forEach(k => { html += `<th>${k.nama || "(tanpa nama)"}</th>`; });
  html += "</tr></thead><tbody>";
  alternatifList.forEach((a, ai) => {
    html += `<tr><td style="font-weight:500;color:var(--ink)">${a.nama || "(tanpa nama)"}</td>`;
    kriteriaList.forEach((_, ki) => {
      const key = `${ai}-${ki}`;
      const val = matriksNilai[key] ?? "";
      html += `<td><input type="number" step="any" value="${val}" data-ai="${ai}" data-ki="${ki}" class="mtx-input" placeholder="0"></td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  wrapper.innerHTML = html;

  wrapper.querySelectorAll(".mtx-input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      matriksNilai[`${e.target.dataset.ai}-${e.target.dataset.ki}`] = parseFloat(e.target.value) || 0;
    });
  });
}

// ---------- RENDER HASIL TABLE ----------
function renderHasilTable(tbody, hasilArr) {
  tbody.innerHTML = "";
  const maxSkor = Math.max(...hasilArr.map(h => h.skor));
  hasilArr.forEach(h => {
    const rankClass = h.ranking === 1 ? "gold" : h.ranking === 2 ? "silver" : h.ranking === 3 ? "bronze" : "";
    const barPct = maxSkor > 0 ? (h.skor / maxSkor * 100).toFixed(1) : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="rank-badge ${rankClass}">${h.ranking}</span></td>
      <td style="font-weight:500">${h.alternatif_nama}</td>
      <td style="font-family:'SF Mono','Fira Mono',monospace;font-size:13px">${h.skor.toFixed(4)}</td>
      <td>
        <div class="score-bar-wrap">
          <div class="score-bar-fill" style="width:${barPct}%"></div>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ---------- HITUNG & SIMPAN ----------
document.getElementById("btn-hitung").addEventListener("click", async () => {
  const statusEl = document.getElementById("status-msg");
  statusEl.className = "status-msg";
  statusEl.textContent = "Menghitung...";

  const nama = document.getElementById("input-nama").value.trim();
  const metode = document.getElementById("input-metode").value;
  const deskripsi = document.getElementById("input-deskripsi").value.trim();

  if (!nama) { statusEl.textContent = "Nama studi kasus wajib diisi."; statusEl.className = "status-msg error"; return; }
  if (kriteriaList.length === 0) { statusEl.textContent = "Tambahkan minimal 1 kriteria."; statusEl.className = "status-msg error"; return; }
  if (alternatifList.length === 0) { statusEl.textContent = "Tambahkan minimal 1 alternatif."; statusEl.className = "status-msg error"; return; }

  const btn = document.getElementById("btn-hitung");
  btn.disabled = true;

  const matriks = [];
  for (let ai = 0; ai < alternatifList.length; ai++) {
    for (let ki = 0; ki < kriteriaList.length; ki++) {
      matriks.push({ alternatif_index: ai, kriteria_index: ki, nilai: matriksNilai[`${ai}-${ki}`] ?? 0 });
    }
  }

  const payload = {
    nama, deskripsi: deskripsi || null, metode,
    kriteria: kriteriaList.map(k => ({ nama: k.nama, bobot: parseFloat(k.bobot), tipe: k.tipe })),
    alternatif: alternatifList.map(a => ({ nama: a.nama })),
    matriks,
  };

  try {
    const res = await fetch(`${API}/api/studi-kasus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Gagal menghitung");

    lastHasilData = data;
    statusEl.textContent = "Berhasil dihitung dan disimpan!";
    statusEl.className = "status-msg success";
    showToast("Studi kasus berhasil disimpan ✓", "success");

    document.getElementById("hasil-card").style.display = "block";
    document.getElementById("hasil-meta").textContent = `${data.metode} · ${data.nama}`;
    renderHasilTable(document.querySelector("#tabel-hasil tbody"), data.hasil);
    document.getElementById("hasil-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = "status-msg error";
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

// ---------- RIWAYAT ----------
async function muatRiwayat() {
  const tbody = document.querySelector("#tabel-riwayat tbody");
  tbody.innerHTML = '<tr><td colspan="4" class="td-loading">Memuat data...</td></tr>';
  try {
    const res = await fetch(`${API}/api/studi-kasus`);
    const data = await res.json();
    tbody.innerHTML = "";
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="td-loading">Belum ada studi kasus.</td></tr>';
      return;
    }
    data.forEach(s => {
      const tr = document.createElement("tr");
      const tanggal = new Date(s.dibuat_pada).toLocaleString("id-ID");
      const metodeBadge = s.metode === "SAW"
        ? `<span style="background:rgba(91,142,240,0.15);color:var(--accent);padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600">SAW</span>`
        : `<span style="background:rgba(123,110,240,0.15);color:var(--accent-2);padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600">TOPSIS</span>`;
      tr.innerHTML = `
        <td style="font-weight:500">${s.nama}</td>
        <td>${metodeBadge}</td>
        <td style="color:var(--ink-soft);font-size:13px">${tanggal}</td>
        <td><button class="btn-ghost" style="font-size:12px;padding:5px 10px" data-id="${s.id}" data-action="lihat">Lihat</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="td-loading">Gagal memuat: ${err.message}</td></tr>`;
  }
}

document.querySelector("#tabel-riwayat tbody").addEventListener("click", async (e) => {
  if (e.target.dataset.action === "lihat") {
    const id = e.target.dataset.id;
    try {
      const res = await fetch(`${API}/api/studi-kasus/${id}`);
      const data = await res.json();
      lastRiwayatData = data;
      document.getElementById("riwayat-detail-card").style.display = "block";
      document.getElementById("riwayat-detail-title").textContent = `${data.nama} — ${data.metode}`;
      renderHasilTable(document.querySelector("#tabel-riwayat-detail tbody"), data.hasil);
      document.getElementById("riwayat-detail-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      showToast("Gagal memuat detail: " + err.message, "error");
    }
  }
});

document.getElementById("btn-refresh-riwayat").addEventListener("click", muatRiwayat);

// ---------- EXPORT CSV ----------
function hasilToCSV(data) {
  const rows = [["Ranking", "Alternatif", "Skor", "Metode", "Studi Kasus"]];
  data.hasil.forEach(h => {
    rows.push([h.ranking, h.alternatif_nama, h.skor.toFixed(6), data.metode, data.nama]);
  });
  return rows.map(r => r.join(",")).join("\n");
}

function hasilToJSON(data) {
  return JSON.stringify(data, null, 2);
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("btn-export-csv-result").addEventListener("click", () => {
  if (!lastHasilData) { showToast("Belum ada data untuk diekspor.", "error"); return; }
  downloadFile(hasilToCSV(lastHasilData), `DSS_${lastHasilData.nama}_${lastHasilData.metode}.csv`, "text/csv");
  showToast("File CSV berhasil diunduh ✓", "success");
});

document.getElementById("btn-export-csv-riwayat").addEventListener("click", () => {
  if (!lastRiwayatData) { showToast("Pilih riwayat terlebih dahulu.", "error"); return; }
  downloadFile(hasilToCSV(lastRiwayatData), `DSS_${lastRiwayatData.nama}_${lastRiwayatData.metode}.csv`, "text/csv");
  showToast("File CSV berhasil diunduh ✓", "success");
});

// ---------- EXPORT TAB — All data ----------
document.getElementById("btn-export-all-csv").addEventListener("click", async () => {
  try {
    const res = await fetch(`${API}/api/studi-kasus`);
    const list = await res.json();
    if (list.length === 0) { showToast("Belum ada data studi kasus.", "error"); return; }

    // Fetch detail semua
    const details = await Promise.all(list.map(s => fetch(`${API}/api/studi-kasus/${s.id}`).then(r => r.json())));
    const rows = [["ID", "Nama", "Metode", "Dibuat", "Ranking", "Alternatif", "Skor"]];
    details.forEach(d => {
      d.hasil.forEach(h => {
        rows.push([d.id, d.nama, d.metode, d.dibuat_pada, h.ranking, h.alternatif_nama, h.skor.toFixed(6)]);
      });
    });
    downloadFile(rows.map(r => r.join(",")).join("\n"), `DSS_Semua_Studi_Kasus.csv`, "text/csv");
    showToast("CSV semua data berhasil diunduh ✓", "success");
  } catch (err) {
    showToast("Gagal export: " + err.message, "error");
  }
});

document.getElementById("btn-export-all-json").addEventListener("click", async () => {
  try {
    const res = await fetch(`${API}/api/studi-kasus`);
    const list = await res.json();
    if (list.length === 0) { showToast("Belum ada data studi kasus.", "error"); return; }
    const details = await Promise.all(list.map(s => fetch(`${API}/api/studi-kasus/${s.id}`).then(r => r.json())));
    downloadFile(JSON.stringify(details, null, 2), `DSS_Semua_Studi_Kasus.json`, "application/json");
    showToast("JSON semua data berhasil diunduh ✓", "success");
  } catch (err) {
    showToast("Gagal export: " + err.message, "error");
  }
});

// ---------- AUTH (SIMULASI — bisa disambung OAuth nyata) ----------
// Catatan: Google & Microsoft OAuth asli butuh client_id dari GCP/Azure.
// Di sini kita buat simulasi UI yang lengkap. Panduan koneksi OAuth nyata
// ada di PANDUAN.md yang diupgrade.

function setLoggedIn(name, email, provider) {
  currentUser = { name, email, provider };

  // Sidebar
  document.getElementById("auth-section-sidebar").style.display = "none";
  document.getElementById("user-profile-sidebar").style.display = "block";
  document.getElementById("user-avatar-text").textContent = name.charAt(0).toUpperCase();
  document.getElementById("user-display-name").textContent = name;
  document.getElementById("user-display-email").textContent = email;

  // Jika Microsoft → tampilkan Power BI connected area
  if (provider === "microsoft") {
    document.getElementById("pbi-login-area").style.display = "none";
    document.getElementById("pbi-connected-area").style.display = "block";
    document.getElementById("pbi-user-name").textContent = name;
    document.getElementById("pbi-status-badge").className = "pbi-status-badge connected";
    document.getElementById("pbi-status-badge").innerHTML = '<span class="dot-online"></span> Terhubung ke Power BI';
  }

  showToast(`Login sebagai ${name} (${provider}) ✓`, "success");
}

function setLoggedOut() {
  currentUser = null;
  pbiAccessToken = null;
  document.getElementById("auth-section-sidebar").style.display = "flex";
  document.getElementById("auth-section-sidebar").style.flexDirection = "column";
  document.getElementById("user-profile-sidebar").style.display = "none";
  document.getElementById("pbi-login-area").style.display = "block";
  document.getElementById("pbi-connected-area").style.display = "none";
  document.getElementById("pbi-status-badge").className = "pbi-status-badge";
  document.getElementById("pbi-status-badge").innerHTML = '<span class="dot-offline"></span> Belum terhubung';
  showToast("Berhasil logout.", "");
}

// Simulasi Google Login (ganti dengan google OAuth SDK jika sudah punya Client ID)
function doGoogleLogin() {
  // Untuk implementasi nyata:
  // 1. Daftar di console.cloud.google.com → buat OAuth 2.0 Client ID
  // 2. Load Google Identity Services: <script src="https://accounts.google.com/gsi/client">
  // 3. Panggil google.accounts.id.initialize({ client_id: "YOUR_CLIENT_ID", callback: handleCredentialResponse })
  // 4. google.accounts.id.prompt()

  // SIMULASI:
  const name = prompt("Simulasi Google Login\nMasukkan nama kamu:");
  const email = prompt("Masukkan email Google kamu:");
  if (name && email) setLoggedIn(name, email, "google");
}

// Simulasi Microsoft Login (ganti dengan MSAL.js jika sudah punya Azure App)
function doMicrosoftLogin() {
  // Untuk implementasi nyata:
  // 1. Daftar di portal.azure.com → App registrations → New registration
  // 2. Tambahkan permission: Power BI Service → Dataset.ReadWrite.All
  // 3. Load MSAL: <script src="https://alcdn.msauth.net/browser/2.39.0/js/msal-browser.min.js">
  // 4. const msalInstance = new msal.PublicClientApplication({ auth: { clientId: "YOUR_CLIENT_ID" } })
  // 5. msalInstance.loginPopup({ scopes: ["https://analysis.windows.net/powerbi/api/Dataset.ReadWrite.All"] })
  //    .then(resp => { pbiAccessToken = resp.accessToken; setLoggedIn(...) })

  // SIMULASI:
  const name = prompt("Simulasi Microsoft Login\nMasukkan nama akun Microsoft kamu:");
  const email = prompt("Masukkan email Microsoft/Power BI kamu:");
  if (name && email) {
    pbiAccessToken = "SIMULATED_TOKEN_" + Date.now(); // nanti diganti token MSAL asli
    setLoggedIn(name, email, "microsoft");
  }
}

document.getElementById("btn-login-google").addEventListener("click", doGoogleLogin);
document.getElementById("btn-login-ms").addEventListener("click", doMicrosoftLogin);
document.getElementById("btn-login-google-side").addEventListener("click", doGoogleLogin);
document.getElementById("btn-login-ms-side").addEventListener("click", doMicrosoftLogin);
document.getElementById("btn-logout").addEventListener("click", setLoggedOut);

// ---------- PUSH KE POWER BI ----------
document.getElementById("btn-push-pbi").addEventListener("click", async () => {
  const statusEl = document.getElementById("pbi-push-status");
  const workspaceId = document.getElementById("pbi-workspace-id").value.trim();
  const datasetId = document.getElementById("pbi-dataset-id").value.trim();
  const tableName = document.getElementById("pbi-table-name").value.trim() || "Hasil";

  if (!workspaceId || !datasetId) {
    statusEl.textContent = "Workspace ID dan Dataset ID wajib diisi.";
    statusEl.className = "status-msg error";
    return;
  }
  if (!pbiAccessToken) {
    statusEl.textContent = "Login dengan Microsoft terlebih dahulu.";
    statusEl.className = "status-msg error";
    return;
  }

  statusEl.textContent = "Mengambil data dari server...";
  statusEl.className = "status-msg";

  try {
    // Ambil semua data dari backend
    const res = await fetch(`${API}/api/studi-kasus`);
    const list = await res.json();
    if (list.length === 0) throw new Error("Belum ada data studi kasus.");

    const details = await Promise.all(list.map(s => fetch(`${API}/api/studi-kasus/${s.id}`).then(r => r.json())));

    // Format rows untuk Power BI Push Dataset
    const rows = [];
    details.forEach(d => {
      d.hasil.forEach(h => {
        rows.push({
          StudiKasusId: d.id,
          NamaStudiKasus: d.nama,
          Metode: d.metode,
          DibuatPada: d.dibuat_pada,
          Ranking: h.ranking,
          AlternatifNama: h.alternatif_nama,
          Skor: h.skor,
        });
      });
    });

    // Push ke Power BI REST API
    // Endpoint: POST https://api.powerbi.com/v1.0/myorg/groups/{workspaceId}/datasets/{datasetId}/tables/{tableName}/rows
    statusEl.textContent = `Mengirim ${rows.length} baris ke Power BI...`;

    const pbiRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/tables/${tableName}/rows`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${pbiAccessToken}`,
        },
        body: JSON.stringify({ rows }),
      }
    );

    if (!pbiRes.ok) {
      const errText = await pbiRes.text();
      // Kalau token simulasi, akan dapat CORS/auth error — itu normal di mode simulasi
      if (pbiAccessToken.startsWith("SIMULATED_TOKEN")) {
        statusEl.textContent = `[Mode Simulasi] Data siap dikirim (${rows.length} baris). Sambungkan Azure App untuk push nyata.`;
        statusEl.className = "status-msg success";
        showToast(`[Simulasi] ${rows.length} baris siap untuk Power BI ✓`, "success");
        return;
      }
      throw new Error(errText || "Gagal push ke Power BI");
    }

    statusEl.textContent = `Berhasil push ${rows.length} baris ke Power BI!`;
    statusEl.className = "status-msg success";
    showToast(`${rows.length} baris berhasil dikirim ke Power BI ✓`, "success");
  } catch (err) {
    if (pbiAccessToken && pbiAccessToken.startsWith("SIMULATED_TOKEN")) {
      statusEl.textContent = "[Mode Simulasi] Sambungkan Azure App untuk push nyata ke Power BI.";
      statusEl.className = "status-msg";
      showToast("Mode simulasi aktif — butuh Azure App ID untuk push nyata.", "");
    } else {
      statusEl.textContent = "Error: " + err.message;
      statusEl.className = "status-msg error";
      showToast("Gagal push ke Power BI: " + err.message, "error");
    }
  }
});

// ---------- INIT ----------
renderKriteria();
renderAlternatif();
updateApiUrlDisplay();
