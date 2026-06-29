/* =====================================================
   AnimeRank DSS — app.js
   Fitur: SAW/TOPSIS, Chart, What-If, Export, Unit Test,
          Running Game, Custom Cursor, Chibi Canvas
   ===================================================== */

const API = "";

// ===== STATE =====
let kriteriaList = [];
let alternatifList = [];
let matriksNilai = {};
let lastHasilData = null;
let lastRiwayatData = null;
let currentUser = null;
let pbiAccessToken = null;
let lastChart = null;
let whatifChart = null;
let riwayatChart = null;
let whatifCachedData = null;  // studi kasus yg dipilih untuk what-if
let allRiwayat = [];

// ===== DEFAULT DATA (contoh anime) =====
const DEFAULT_KRITERIA = [
  { nama: "Story / Plot",     bobot: 0.30, tipe: "benefit" },
  { nama: "Animation Quality",bobot: 0.25, tipe: "benefit" },
  { nama: "Soundtrack / OST", bobot: 0.25, tipe: "benefit" },
  { nama: "Harga Nonton ($/bl)", bobot: 0.20, tipe: "cost" },
];
const DEFAULT_ALTERNATIF = [
  { nama: "Attack on Titan" },
  { nama: "Demon Slayer" },
  { nama: "Jujutsu Kaisen" },
  { nama: "Spy x Family" },
  { nama: "Oshi no Ko" },
];
// [alternatif][kriteria] — Story, Animation, OST, Harga
const DEFAULT_MATRIKS = [
  [9.5, 9.0, 9.2, 15],
  [9.0, 9.8, 9.5, 13],
  [8.8, 9.5, 8.7, 13],
  [8.5, 8.8, 8.5, 10],
  [9.2, 9.0, 9.0, 12],
];

// ===== TOAST =====
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + type + " show";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3200);
}

// ===== SERVER HEALTH =====
async function checkServer() {
  const dot = document.getElementById("server-dot");
  const lbl = document.getElementById("server-label");
  try {
    const r = await fetch(`${API}/api/health`);
    if (r.ok) { dot.className = "server-dot ok"; lbl.textContent = "Online"; }
    else throw new Error();
  } catch {
    dot.className = "server-dot err"; lbl.textContent = "Offline";
  }
}
checkServer();
setInterval(checkServer, 30000);

// ===== SIDEBAR / TAB =====
const TAB_TITLES = { baru:"Studi Kasus Baru", riwayat:"Riwayat", whatif:"What-If Analysis", export:"Export & Power BI", test:"Unit Test" };
const CHIBI_MESSAGES = {
  baru: "Yosh! Ayo mulai analisis~", riwayat: "Cek riwayatmu disini!", whatif: "Coba-coba dulu boleh kok~",
  export: "Download datanya yuk!", test: "Ayo test algoritmanya!"
};

document.getElementById("sidebar-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

document.querySelectorAll(".nav-item[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item[data-tab]").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-" + tab).classList.add("active");
    document.getElementById("topbar-page").textContent = TAB_TITLES[tab];
    document.getElementById("chibi-speech").textContent = CHIBI_MESSAGES[tab] || "Ganbare!";
    if (tab === "riwayat") muatRiwayat();
    if (tab === "export") updateApiUrl();
    if (tab === "whatif") populateWhatifSelect();
    if (window.innerWidth <= 768) document.getElementById("sidebar").classList.remove("open");
  });
});

function updateApiUrl() {
  const el = document.getElementById("api-url-display");
  if (el) el.textContent = window.location.origin + "/api/studi-kasus";
}

// ===== KRITERIA =====
function renderKriteria() {
  const tbody = document.querySelector("#tabel-kriteria tbody");
  tbody.innerHTML = "";
  kriteriaList.forEach((k, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" value="${k.nama}" data-i="${i}" data-f="nama" class="kr-inp" placeholder="Nama kriteria"></td>
      <td><input type="number" step="0.01" min="0" max="1" value="${k.bobot}" data-i="${i}" data-f="bobot" class="kr-inp"></td>
      <td><select data-i="${i}" data-f="tipe" class="kr-inp">
        <option value="benefit" ${k.tipe==="benefit"?"selected":""}>Benefit — makin besar makin baik</option>
        <option value="cost" ${k.tipe==="cost"?"selected":""}>Cost — makin kecil makin baik</option>
      </select></td>
      <td><button class="btn-remove" data-i="${i}" data-action="rm-k">✕</button></td>`;
    tbody.appendChild(tr);
  });
  updateBobotBar("bobot-fill","total-bobot", kriteriaList);
  renderMatriks();
}

function updateBobotBar(fillId, valId, list) {
  const total = list.reduce((s,k) => s + (parseFloat(k.bobot)||0), 0);
  const pct = Math.min(total*100, 100);
  const fill = document.getElementById(fillId);
  const val = document.getElementById(valId);
  if (!fill || !val) return;
  fill.style.width = pct + "%";
  val.textContent = total.toFixed(2);
  const good = Math.abs(total-1)<0.01, over = total>1.01;
  fill.className = "bobot-fill" + (good?" good":over?" over":"");
  val.className = "bobot-val" + (good?" good":over?" over":"");
}

document.getElementById("btn-tambah-kriteria").addEventListener("click", () => {
  kriteriaList.push({nama:"",bobot:0,tipe:"benefit"}); renderKriteria();
});
document.querySelector("#tabel-kriteria tbody").addEventListener("input", e => {
  const i = e.target.dataset.i, f = e.target.dataset.f;
  if (!i) return;
  kriteriaList[i][f] = f==="bobot" ? parseFloat(e.target.value)||0 : e.target.value;
  if (f==="bobot") updateBobotBar("bobot-fill","total-bobot",kriteriaList);
  if (f==="nama") renderMatriks();
});
document.querySelector("#tabel-kriteria tbody").addEventListener("click", e => {
  if (e.target.dataset.action==="rm-k") { kriteriaList.splice(e.target.dataset.i,1); renderKriteria(); }
});

// ===== ALTERNATIF =====
function renderAlternatif() {
  const tbody = document.querySelector("#tabel-alternatif tbody");
  tbody.innerHTML = "";
  alternatifList.forEach((a, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" value="${a.nama}" data-i="${i}" class="alt-inp" placeholder="Nama anime..."></td>
      <td><button class="btn-remove" data-i="${i}" data-action="rm-a">✕</button></td>`;
    tbody.appendChild(tr);
  });
  renderMatriks();
}
document.getElementById("btn-tambah-alternatif").addEventListener("click", () => {
  alternatifList.push({nama:""}); renderAlternatif();
});
document.querySelector("#tabel-alternatif tbody").addEventListener("input", e => {
  const i = e.target.dataset.i; if (!i) return;
  alternatifList[i].nama = e.target.value; renderMatriks();
});
document.querySelector("#tabel-alternatif tbody").addEventListener("click", e => {
  if (e.target.dataset.action==="rm-a") { alternatifList.splice(e.target.dataset.i,1); renderAlternatif(); }
});

// ===== MATRIKS =====
function renderMatriks() {
  const w = document.getElementById("matriks-wrapper");
  if (!kriteriaList.length || !alternatifList.length) {
    w.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Isi kriteria dan alternatif dulu ya~</p></div>`;
    return;
  }
  let html = `<table class="grid-table"><thead><tr><th>Anime</th>`;
  kriteriaList.forEach(k => { html += `<th>${k.nama||"(tanpa nama)"}</th>`; });
  html += `</tr></thead><tbody>`;
  alternatifList.forEach((a, ai) => {
    html += `<tr><td style="font-weight:600;color:var(--ink)">${a.nama||"(tanpa nama)"}</td>`;
    kriteriaList.forEach((_, ki) => {
      const v = matriksNilai[`${ai}-${ki}`] ?? "";
      html += `<td><input type="number" step="any" value="${v}" data-ai="${ai}" data-ki="${ki}" class="mtx-inp" placeholder="0"></td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  w.innerHTML = html;
  w.querySelectorAll(".mtx-inp").forEach(inp => {
    inp.addEventListener("input", e => { matriksNilai[`${e.target.dataset.ai}-${e.target.dataset.ki}`] = parseFloat(e.target.value)||0; });
  });
}

// ===== ALGORITMA SAW =====
function hitungSAW(matriks, kriteria) {
  const nAlt = matriks.length, nKrit = kriteria.length;
  const norm = Array.from({length:nAlt}, () => new Array(nKrit).fill(0));
  for (let j=0; j<nKrit; j++) {
    const col = matriks.map(r => r[j]);
    if (kriteria[j].tipe === "benefit") {
      const mx = Math.max(...col);
      for (let i=0; i<nAlt; i++) norm[i][j] = mx ? matriks[i][j]/mx : 0;
    } else {
      const mn = Math.min(...col);
      for (let i=0; i<nAlt; i++) norm[i][j] = matriks[i][j] ? mn/matriks[i][j] : 0;
    }
  }
  return norm.map(row => row.reduce((s,v,j) => s + v*kriteria[j].bobot, 0));
}

// ===== ALGORITMA TOPSIS =====
function hitungTOPSIS(matriks, kriteria) {
  const nAlt = matriks.length, nKrit = kriteria.length;
  // Step 1: normalisasi vektor
  const norm = Array.from({length:nAlt}, () => new Array(nKrit).fill(0));
  for (let j=0; j<nKrit; j++) {
    const denom = Math.sqrt(matriks.reduce((s,r) => s + r[j]**2, 0));
    for (let i=0; i<nAlt; i++) norm[i][j] = denom ? matriks[i][j]/denom : 0;
  }
  // Step 2: bobot
  const w = norm.map(row => row.map((v,j) => v*kriteria[j].bobot));
  // Step 3: solusi ideal
  const A_pos = [], A_neg = [];
  for (let j=0; j<nKrit; j++) {
    const col = w.map(r => r[j]);
    if (kriteria[j].tipe==="benefit") { A_pos.push(Math.max(...col)); A_neg.push(Math.min(...col)); }
    else { A_pos.push(Math.min(...col)); A_neg.push(Math.max(...col)); }
  }
  // Step 4 & 5: jarak & skor
  return w.map(row => {
    const dp = Math.sqrt(row.reduce((s,v,j) => s+(v-A_pos[j])**2, 0));
    const dn = Math.sqrt(row.reduce((s,v,j) => s+(v-A_neg[j])**2, 0));
    return (dp+dn) ? dn/(dp+dn) : 0;
  });
}

// ===== RENDER HASIL TABLE =====
function renderHasilTable(tbodyEl, hasil) {
  tbodyEl.innerHTML = "";
  const mx = Math.max(...hasil.map(h=>h.skor));
  hasil.forEach(h => {
    const rc = h.ranking===1?"r1":h.ranking===2?"r2":h.ranking===3?"r3":"";
    const pct = mx>0 ? (h.skor/mx*100).toFixed(1) : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="rank-badge ${rc}">${h.ranking}</span></td>
      <td style="font-weight:600">${h.alternatif_nama}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:13px">${h.skor.toFixed(4)}</td>
      <td><div class="score-bar"><div class="score-bar-fill" style="width:${pct}%"></div></div></td>`;
    tbodyEl.appendChild(tr);
  });
}

// ===== RENDER CHART =====
function renderChart(canvasId, hasil, chartRef) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  if (chartRef) chartRef.destroy();
  const labels = hasil.map(h => h.alternatif_nama);
  const data = hasil.map(h => h.skor);
  const colors = hasil.map(h => h.ranking===1?"rgba(251,191,36,0.8)":h.ranking===2?"rgba(203,213,225,0.7)":h.ranking===3?"rgba(205,133,63,0.7)":"rgba(108,142,255,0.65)");
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Skor",
        data,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace(/[\d.]+\)$/, "1)")),
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => " Skor: " + ctx.parsed.y.toFixed(4) } }
      },
      scales: {
        x: { ticks: { color: "#94a3b8", font:{size:11} }, grid: { color: "rgba(255,255,255,0.04)" } },
        y: { ticks: { color: "#94a3b8", font:{size:11} }, grid: { color: "rgba(255,255,255,0.06)" }, beginAtZero: true }
      }
    }
  });
}

// ===== HITUNG & SIMPAN =====
document.getElementById("btn-hitung").addEventListener("click", async () => {
  const statusEl = document.getElementById("status-msg");
  statusEl.className = "status-msg";
  statusEl.textContent = "Menghitung...";

  const nama = document.getElementById("input-nama").value.trim();
  const metode = document.getElementById("input-metode").value;
  const deskripsi = document.getElementById("input-deskripsi").value.trim();

  if (!nama) { statusEl.className="status-msg error"; statusEl.textContent="Nama studi kasus wajib diisi."; return; }
  if (!kriteriaList.length) { statusEl.className="status-msg error"; statusEl.textContent="Tambahkan minimal 1 kriteria."; return; }
  if (!alternatifList.length) { statusEl.className="status-msg error"; statusEl.textContent="Tambahkan minimal 1 alternatif."; return; }

  const totalBobot = kriteriaList.reduce((s,k)=>s+(parseFloat(k.bobot)||0),0);
  if (Math.abs(totalBobot-1)>0.01) { statusEl.className="status-msg error"; statusEl.textContent=`Total bobot harus 1.0 (sekarang ${totalBobot.toFixed(2)})`; return; }

  const btn = document.getElementById("btn-hitung");
  btn.disabled = true;

  const matriks = [];
  for (let ai=0;ai<alternatifList.length;ai++)
    for (let ki=0;ki<kriteriaList.length;ki++)
      matriks.push({alternatif_index:ai, kriteria_index:ki, nilai:matriksNilai[`${ai}-${ki}`]??0});

  const payload = {
    nama, deskripsi: deskripsi||null, metode,
    kriteria: kriteriaList.map(k=>({nama:k.nama, bobot:parseFloat(k.bobot), tipe:k.tipe})),
    alternatif: alternatifList.map(a=>({nama:a.nama})),
    matriks
  };

  try {
    // Coba kirim ke backend
    let data;
    try {
      const res = await fetch(`${API}/api/studi-kasus`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
      data = await res.json();
      if (!res.ok) throw new Error(data.detail||"Server error");
    } catch (serverErr) {
      // Hitung lokal jika backend offline
      console.warn("Backend offline, hitung lokal:", serverErr.message);
      const mat2d = Array.from({length:alternatifList.length}, (_,ai) =>
        Array.from({length:kriteriaList.length}, (_,ki) => matriksNilai[`${ai}-${ki}`]||0));
      const kritDict = kriteriaList.map(k=>({bobot:parseFloat(k.bobot),tipe:k.tipe}));
      const skorList = metode==="SAW" ? hitungSAW(mat2d, kritDict) : hitungTOPSIS(mat2d, kritDict);
      const urutan = [...Array(alternatifList.length).keys()].sort((a,b)=>skorList[b]-skorList[a]);
      const rankMap = {}; urutan.forEach((idx,pos)=>rankMap[idx]=pos+1);
      data = {
        id: Date.now(), nama, deskripsi, metode, dibuat_pada: new Date().toISOString(),
        hasil: alternatifList.map((a,i)=>({alternatif_nama:a.nama, skor:Math.round(skorList[i]*1e6)/1e6, ranking:rankMap[i]}))
          .sort((a,b)=>a.ranking-b.ranking)
      };
      showToast("⚠️ Backend offline — dihitung lokal (tidak tersimpan)", "");
    }

    lastHasilData = data;
    statusEl.className = "status-msg success";
    statusEl.textContent = "✓ Berhasil dihitung!";

    document.getElementById("hasil-card").style.display = "block";
    document.getElementById("hasil-title").textContent = `Ranking ${metode} — ${nama}`;
    renderHasilTable(document.querySelector("#tabel-hasil tbody"), data.hasil);
    lastChart = renderChart("hasil-chart", data.hasil, lastChart);
    document.getElementById("hasil-card").scrollIntoView({behavior:"smooth", block:"nearest"});

    // Trigger karakter celebrate
    triggerCelebrate();
    showToast("🎉 " + data.hasil[0].alternatif_nama + " meraih ranking 1!", "success");
  } catch (err) {
    statusEl.className = "status-msg error";
    statusEl.textContent = err.message;
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

// ===== RIWAYAT =====
async function muatRiwayat() {
  const tbody = document.querySelector("#tabel-riwayat tbody");
  tbody.innerHTML = '<tr><td colspan="4" class="td-center">Memuat...</td></tr>';
  try {
    const res = await fetch(`${API}/api/studi-kasus`);
    const data = await res.json();
    allRiwayat = data;
    tbody.innerHTML = "";
    if (!data.length) { tbody.innerHTML='<tr><td colspan="4" class="td-center">Belum ada studi kasus.</td></tr>'; return; }
    data.forEach(s => {
      const tr = document.createElement("tr");
      const tgl = new Date(s.dibuat_pada).toLocaleString("id-ID");
      const badge = `<span style="background:rgba(108,142,255,0.15);color:var(--accent);padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700">${s.metode}</span>`;
      tr.innerHTML = `<td style="font-weight:600">${s.nama}</td><td>${badge}</td><td style="font-size:12px;color:var(--ink2)">${tgl}</td><td><button class="btn-ghost" style="font-size:12px;padding:5px 10px" data-id="${s.id}" data-action="lihat">Lihat</button></td>`;
      tbody.appendChild(tr);
    });
    populateWhatifSelect();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="td-center">Gagal: ${err.message}</td></tr>`;
  }
}

document.querySelector("#tabel-riwayat tbody").addEventListener("click", async e => {
  if (e.target.dataset.action==="lihat") {
    try {
      const res = await fetch(`${API}/api/studi-kasus/${e.target.dataset.id}`);
      const data = await res.json();
      lastRiwayatData = data;
      document.getElementById("riwayat-detail-card").style.display = "block";
      document.getElementById("riwayat-detail-title").textContent = `${data.nama} — ${data.metode}`;
      renderHasilTable(document.querySelector("#tabel-riwayat-detail tbody"), data.hasil);
      riwayatChart = renderChart("riwayat-chart", data.hasil, riwayatChart);
      document.getElementById("riwayat-detail-card").scrollIntoView({behavior:"smooth",block:"nearest"});
    } catch(err) { showToast("Gagal memuat detail: "+err.message,"error"); }
  }
});

document.getElementById("btn-refresh-riwayat").addEventListener("click", muatRiwayat);

// ===== WHAT-IF =====
function populateWhatifSelect() {
  const sel = document.getElementById("whatif-select");
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Pilih --</option>';
  allRiwayat.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id; opt.textContent = `${s.nama} (${s.metode})`;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

document.getElementById("whatif-select").addEventListener("change", async function() {
  const id = this.value;
  if (!id) { whatifCachedData = null; document.getElementById("whatif-sliders").innerHTML = ""; return; }
  try {
    const res = await fetch(`${API}/api/studi-kasus/${id}`);
    const data = await res.json();
    whatifCachedData = data;
    buildWhatifSliders(data);
  } catch(err) { showToast("Gagal load studi kasus: "+err.message,"error"); }
});

function buildWhatifSliders(data) {
  const wrap = document.getElementById("whatif-sliders");
  wrap.innerHTML = "";
  const kriteria = (data.kriteria || []);
  if (!kriteria.length) {
    // Fallback: ambil dari daftar kriteria saat ini
    wrap.innerHTML = '<p class="hint">Studi kasus ini tidak menyimpan data kriteria. Gunakan studi kasus baru.</p>';
    return;
  }
  kriteria.forEach((k, i) => {
    const row = document.createElement("div");
    row.className = "whatif-slider-row";
    row.innerHTML = `
      <div class="whatif-slider-label">
        <span>${k.nama} <span style="font-size:10px;color:var(--ink3)">(${k.tipe})</span></span>
        <span class="whatif-slider-val" id="wi-val-${i}">${(k.bobot||0).toFixed(2)}</span>
      </div>
      <input type="range" min="0" max="1" step="0.01" value="${k.bobot||0}" data-ki="${i}" id="wi-slider-${i}">`;
    wrap.appendChild(row);
    document.getElementById(`wi-slider-${i}`).addEventListener("input", function() {
      document.getElementById(`wi-val-${i}`).textContent = parseFloat(this.value).toFixed(2);
      updateWhatifBobotBar();
    });
  });
  updateWhatifBobotBar();
}

function updateWhatifBobotBar() {
  if (!whatifCachedData || !whatifCachedData.kriteria) return;
  const vals = whatifCachedData.kriteria.map((_,i) => {
    const sl = document.getElementById(`wi-slider-${i}`);
    return sl ? parseFloat(sl.value)||0 : 0;
  });
  const total = vals.reduce((s,v)=>s+v,0);
  const fill = document.getElementById("whatif-bobot-fill");
  const valEl = document.getElementById("whatif-total");
  if (!fill || !valEl) return;
  fill.style.width = Math.min(total*100,100)+"%";
  valEl.textContent = total.toFixed(2);
  const good = Math.abs(total-1)<0.01, over = total>1.01;
  fill.className = "bobot-fill"+(good?" good":over?" over":"");
  valEl.className = "bobot-val"+(good?" good":over?" over":"");
}

document.getElementById("btn-whatif-hitung").addEventListener("click", async () => {
  if (!whatifCachedData) { showToast("Pilih studi kasus dulu!","error"); return; }
  const kriteria = whatifCachedData.kriteria;
  if (!kriteria || !kriteria.length) { showToast("Data kriteria tidak tersedia.","error"); return; }

  // Ambil bobot baru dari slider
  const bobotBaru = kriteria.map((_,i) => {
    const sl = document.getElementById(`wi-slider-${i}`);
    return sl ? parseFloat(sl.value)||0 : 0;
  });
  const total = bobotBaru.reduce((s,v)=>s+v,0);
  if (Math.abs(total-1)>0.01) { showToast(`Total bobot harus 1.0 (sekarang ${total.toFixed(2)})`,"error"); return; }

  // Ambil data nilai dari backend
  try {
    const res = await fetch(`${API}/api/studi-kasus/${whatifCachedData.id}`);
    const fullData = await res.json();

    // Rebuild matriks dari nilai yang tersimpan
    const nAlt = (fullData.alternatif||[]).length;
    const nKrit = (fullData.kriteria||[]).length;
    if (!nAlt || !nKrit) { showToast("Data matriks tidak tersedia.","error"); return; }

    const mat2d = Array.from({length:nAlt}, (_,ai) =>
      Array.from({length:nKrit}, (_,ki) => {
        const nilaiObj = (fullData.nilai||[]).find(n=>n.alternatif_index===ai && n.kriteria_index===ki);
        return nilaiObj ? nilaiObj.nilai : 0;
      })
    );

    const kritDict = kriteria.map((k,i)=>({bobot:bobotBaru[i], tipe:k.tipe}));
    const metode = whatifCachedData.metode||"SAW";
    const skorList = metode==="SAW" ? hitungSAW(mat2d, kritDict) : hitungTOPSIS(mat2d, kritDict);
    const altNames = (fullData.alternatif||[]).map(a=>a.nama);
    const urutan = [...Array(nAlt).keys()].sort((a,b)=>skorList[b]-skorList[a]);
    const rankMap = {}; urutan.forEach((idx,pos)=>rankMap[idx]=pos+1);
    const hasil = altNames.map((nm,i)=>({alternatif_nama:nm, skor:Math.round(skorList[i]*1e6)/1e6, ranking:rankMap[i]})).sort((a,b)=>a.ranking-b.ranking);

    renderHasilTable(document.querySelector("#tabel-whatif tbody"), hasil);
    whatifChart = renderChart("whatif-chart", hasil, whatifChart);
    showToast("Simulasi selesai! 🎛️","success");
  } catch(err) {
    // Hitung langsung dari lastHasilData jika ada
    showToast("Tidak bisa fetch nilai dari server: "+err.message,"error");
  }
});

// ===== EXPORT =====
function hasilToCSV(data) {
  const rows=[["Ranking","Alternatif","Skor","Metode","Studi Kasus"]];
  data.hasil.forEach(h=>rows.push([h.ranking,h.alternatif_nama,h.skor.toFixed(6),data.metode,data.nama]));
  return rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
}
function downloadFile(content, name, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content],{type:mime}));
  a.download = name; a.click();
}
document.getElementById("btn-export-csv-result").addEventListener("click", ()=>{
  if (!lastHasilData) { showToast("Belum ada hasil.","error"); return; }
  downloadFile(hasilToCSV(lastHasilData),`DSS_${lastHasilData.nama}.csv`,"text/csv");
  showToast("CSV berhasil diunduh ✓","success");
});
document.getElementById("btn-export-csv-riwayat").addEventListener("click", ()=>{
  if (!lastRiwayatData) { showToast("Pilih riwayat dulu.","error"); return; }
  downloadFile(hasilToCSV(lastRiwayatData),`DSS_${lastRiwayatData.nama}.csv`,"text/csv");
  showToast("CSV berhasil diunduh ✓","success");
});
async function exportAll(fmt) {
  try {
    const res = await fetch(`${API}/api/studi-kasus`);
    const list = await res.json();
    if (!list.length) { showToast("Belum ada data.","error"); return; }
    const details = await Promise.all(list.map(s=>fetch(`${API}/api/studi-kasus/${s.id}`).then(r=>r.json())));
    if (fmt==="csv") {
      const rows=[["ID","Nama","Metode","Dibuat","Ranking","Alternatif","Skor"]];
      details.forEach(d=>d.hasil.forEach(h=>rows.push([d.id,d.nama,d.metode,d.dibuat_pada,h.ranking,h.alternatif_nama,h.skor.toFixed(6)])));
      downloadFile(rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n"),"DSS_All.csv","text/csv");
    } else {
      downloadFile(JSON.stringify(details,null,2),"DSS_All.json","application/json");
    }
    showToast(`${fmt.toUpperCase()} diunduh ✓`,"success");
  } catch(err) { showToast("Gagal export: "+err.message,"error"); }
}
document.getElementById("btn-export-all-csv").addEventListener("click", ()=>exportAll("csv"));
document.getElementById("btn-export-all-json").addEventListener("click", ()=>exportAll("json"));

// ===== AUTH =====
let pbiAccessTokenInternal = null;
function setLoggedIn(name, email, provider) {
  currentUser = {name,email,provider};
  document.getElementById("auth-section-sidebar").style.display = "none";
  document.getElementById("user-profile-sidebar").style.display = "block";
  document.getElementById("user-avatar-text").textContent = name[0].toUpperCase();
  document.getElementById("user-display-name").textContent = name;
  document.getElementById("user-display-email").textContent = email;
  if (provider==="microsoft") {
    pbiAccessTokenInternal = "SIMULATED_"+Date.now();
    document.getElementById("pbi-login-area").style.display = "none";
    document.getElementById("pbi-connected-area").style.display = "block";
    document.getElementById("pbi-user-name").textContent = name;
    document.getElementById("pbi-dot").className = "dot-on";
    document.getElementById("pbi-status-text").textContent = "Terhubung ke Power BI";
  }
  showToast(`Login sebagai ${name} ✓`,"success");
}
function setLoggedOut() {
  currentUser = null; pbiAccessTokenInternal = null;
  document.getElementById("auth-section-sidebar").style.display = "block";
  document.getElementById("user-profile-sidebar").style.display = "none";
  document.getElementById("pbi-login-area").style.display = "block";
  document.getElementById("pbi-connected-area").style.display = "none";
  document.getElementById("pbi-dot").className = "dot-off";
  document.getElementById("pbi-status-text").textContent = "Belum terhubung";
  showToast("Berhasil logout.","");
}
function doGoogleLogin() { const n=prompt("Simulasi Google Login\nNama:"), e=prompt("Email:"); if(n&&e) setLoggedIn(n,e,"google"); }
function doMicrosoftLogin() { const n=prompt("Simulasi MS Login\nNama:"), e=prompt("Email:"); if(n&&e) setLoggedIn(n,e,"microsoft"); }
document.getElementById("btn-login-google-side").addEventListener("click", doGoogleLogin);
document.getElementById("btn-login-ms-side").addEventListener("click", doMicrosoftLogin);
document.getElementById("btn-login-ms").addEventListener("click", doMicrosoftLogin);
document.getElementById("btn-logout").addEventListener("click", setLoggedOut);

document.getElementById("btn-push-pbi").addEventListener("click", async ()=>{
  const statusEl = document.getElementById("pbi-push-status");
  if (!pbiAccessTokenInternal) { statusEl.className="status-msg error"; statusEl.textContent="Login Microsoft dulu."; return; }
  statusEl.className="status-msg"; statusEl.textContent="Menyiapkan data...";
  try {
    const res = await fetch(`${API}/api/studi-kasus`);
    const list = await res.json();
    if (!list.length) throw new Error("Belum ada data.");
    const details = await Promise.all(list.map(s=>fetch(`${API}/api/studi-kasus/${s.id}`).then(r=>r.json())));
    const rows = [];
    details.forEach(d=>d.hasil.forEach(h=>rows.push({StudiKasusId:d.id,Nama:d.nama,Metode:d.metode,Ranking:h.ranking,Alternatif:h.alternatif_nama,Skor:h.skor})));
    // Simulasi push (token tidak nyata)
    statusEl.className="status-msg success";
    statusEl.textContent=`[Simulasi] ${rows.length} baris siap → Power BI. Sambungkan Azure App untuk push nyata.`;
    showToast(`${rows.length} baris siap untuk Power BI ✓`,"success");
  } catch(err) { statusEl.className="status-msg error"; statusEl.textContent=err.message; }
});

// ===== UNIT TESTS =====
function runTests() {
  const tests = [];

  // Test 1: SAW — bobot total != 1 (edge case)
  tests.push((() => {
    const mat = [[8,6],[9,7],[7,8]];
    const krit = [{bobot:0.5,tipe:"benefit"},{bobot:0.3,tipe:"benefit"}]; // total=0.8, bukan 1
    const skor = hitungSAW(mat,krit);
    const allNum = skor.every(s=>typeof s==="number"&&!isNaN(s));
    const sumBobot = krit.reduce((s,k)=>s+k.bobot,0);
    return { name:"SAW Edge Case: Bobot Tidak 100%", pass: allNum && Math.abs(sumBobot-1)>0.01,
      detail:`Total bobot = ${sumBobot.toFixed(2)} (bukan 1.0). SAW tetap berjalan tapi hasil tidak valid → backend menolak dengan error 400.` };
  })());

  // Test 2: SAW — semua nilai sama (edge case)
  tests.push((() => {
    const mat = [[5,5],[5,5],[5,5]];
    const krit = [{bobot:0.6,tipe:"benefit"},{bobot:0.4,tipe:"benefit"}];
    const skor = hitungSAW(mat,krit);
    const allSame = skor.every(s=>Math.abs(s-skor[0])<0.0001);
    return { name:"SAW Edge Case: Semua Nilai Alternatif Sama", pass: allSame,
      detail:`Matriks 3×2 semua = 5. Skor = [${skor.map(s=>s.toFixed(4)).join(", ")}]. Semua sama → ranking acak (tie), normalisasi = 1 untuk semua.` };
  })());

  // Test 3: SAW — hasil benar (happy path)
  tests.push((() => {
    const mat = [[9,3],[7,6],[5,9]];
    const krit = [{bobot:0.5,tipe:"benefit"},{bobot:0.5,tipe:"cost"}];
    const skor = hitungSAW(mat,krit);
    // Alt 0: norm_benefit=9/9=1, norm_cost=3/3=1 → skor=1*0.5+1*0.5=1.0 (max)
    const expected = [1.0, 7/9*0.5+3/6*0.5, 5/9*0.5+3/9*0.5];
    const ok = skor.every((s,i)=>Math.abs(s-expected[i])<0.001);
    return { name:"SAW Happy Path: Benefit + Cost Mix", pass: ok,
      detail:`3 alt, 2 kriteria (benefit+cost). Expected ≈ [${expected.map(e=>e.toFixed(4)).join(", ")}], Got = [${skor.map(s=>s.toFixed(4)).join(", ")}]` };
  })());

  // Test 4: TOPSIS — satu alternatif (edge case)
  tests.push((() => {
    const mat = [[8,7,9]];
    const krit = [{bobot:0.4,tipe:"benefit"},{bobot:0.3,tipe:"benefit"},{bobot:0.3,tipe:"cost"}];
    const skor = hitungTOPSIS(mat,krit);
    // Satu alternatif = solusi ideal positif = negatif = sama → jarak 0/0 → skor = 0 (edge)
    return { name:"TOPSIS Edge Case: Hanya 1 Alternatif", pass: skor.length===1 && !isNaN(skor[0]),
      detail:`1 alternatif → D+ = D- = 0 → skor = 0 (tidak bisa dibandingkan). Skor = ${skor[0].toFixed(4)}.` };
  })());

  // Test 5: TOPSIS — 5 alternatif ranking benar
  tests.push((() => {
    const mat = DEFAULT_MATRIKS;
    const krit = DEFAULT_KRITERIA.map(k=>({bobot:k.bobot,tipe:k.tipe}));
    const skor = hitungTOPSIS(mat,krit);
    const urutan = [...Array(skor.length).keys()].sort((a,b)=>skor[b]-skor[a]);
    const allNum = skor.every(s=>typeof s==="number"&&!isNaN(s)&&s>=0&&s<=1);
    const hasBest = skor[urutan[0]] > skor[urutan[urutan.length-1]];
    return { name:"TOPSIS Happy Path: 5 Anime, 4 Kriteria (Data Default)", pass: allNum && hasBest,
      detail:`Skor TOPSIS: ${DEFAULT_ALTERNATIF.map((a,i)=>a.nama+"="+skor[i].toFixed(4)).join(", ")}. Ranking #1: ${DEFAULT_ALTERNATIF[urutan[0]].nama}` };
  })());

  // Test 6: Normalisasi SAW — nilai 0 di kolom cost (edge case)
  tests.push((() => {
    const mat = [[0,5],[3,8]];
    const krit = [{bobot:0.5,tipe:"cost"},{bobot:0.5,tipe:"benefit"}];
    const skor = hitungSAW(mat,krit);
    const noInf = skor.every(s=>isFinite(s)&&!isNaN(s));
    return { name:"SAW Edge Case: Nilai 0 di Kriteria Cost (pembagian nol)", pass: noInf,
      detail:`Alt[0][cost]=0 → pembagian 0/0 → ditangani sebagai 0. Skor = [${skor.map(s=>s.toFixed(4)).join(", ")}]. Tidak ada Infinity/NaN.` };
  })());

  // Render
  const wrap = document.getElementById("test-results-wrap");
  const pass = tests.filter(t=>t.pass).length;
  const total = tests.length;
  wrap.innerHTML = `
    <div class="test-summary">
      <div><div class="test-sum-num" style="color:var(--good)">${pass}</div><div class="test-sum-label">PASSED</div></div>
      <div><div class="test-sum-num" style="color:var(--error)">${total-pass}</div><div class="test-sum-label">FAILED</div></div>
      <div><div class="test-sum-num">${total}</div><div class="test-sum-label">TOTAL</div></div>
    </div>`;
  tests.forEach(t => {
    const div = document.createElement("div");
    div.className = "test-card";
    div.innerHTML = `
      <div class="test-header">
        <span class="test-badge ${t.pass?"pass":"fail"}">${t.pass?"✓ PASS":"✗ FAIL"}</span>
        <span class="test-name">${t.name}</span>
      </div>
      <div class="test-detail">${t.detail}</div>`;
    wrap.appendChild(div);
  });
  showToast(`Test selesai: ${pass}/${total} PASSED ${pass===total?"🎉":""}`,(pass===total?"success":"error"));
}
document.getElementById("btn-run-tests").addEventListener("click", runTests);

// ===== CUSTOM CURSOR (Chibi) =====
const cursorOuter = document.getElementById("cursor-outer");
const chibCanvas = document.getElementById("cursor-canvas");
const chibCtx = chibCanvas.getContext("2d");
let chibState = "idle"; // idle, hover, click, celebrate
let chibFrame = 0;
let mx=0, my=0, tx=0, ty=0;

function drawChibiCursor(state) {
  chibCtx.clearRect(0,0,48,48);
  const cx=24, cy=28;
  // head
  const headColor = state==="click"?"#f472b6":state==="hover"?"#a78bfa":"#ffe4c4";
  chibCtx.fillStyle = headColor;
  chibCtx.beginPath(); chibCtx.ellipse(cx,cy-4,13,12,0,0,Math.PI*2); chibCtx.fill();
  // hair
  chibCtx.fillStyle="#1e1b4b";
  chibCtx.beginPath(); chibCtx.ellipse(cx,cy-14,13,5,0,Math.PI,Math.PI*2); chibCtx.fill();
  chibCtx.beginPath(); chibCtx.ellipse(cx-10,cy-10,4,6,-.5,0,Math.PI*2); chibCtx.fill();
  chibCtx.beginPath(); chibCtx.ellipse(cx+10,cy-10,4,6,.5,0,Math.PI*2); chibCtx.fill();
  // eyes
  if (state==="click"||state==="celebrate") {
    chibCtx.strokeStyle="#1e1b4b"; chibCtx.lineWidth=1.5;
    chibCtx.beginPath(); chibCtx.moveTo(cx-7,cy-4); chibCtx.lineTo(cx-4,cy-2); chibCtx.moveTo(cx-4,cy-4); chibCtx.lineTo(cx-7,cy-2); chibCtx.stroke();
    chibCtx.beginPath(); chibCtx.moveTo(cx+4,cy-4); chibCtx.lineTo(cx+7,cy-2); chibCtx.moveTo(cx+7,cy-4); chibCtx.lineTo(cx+4,cy-2); chibCtx.stroke();
  } else {
    chibCtx.fillStyle="#1e1b4b";
    chibCtx.beginPath(); chibCtx.ellipse(cx-6,cy-3,3,3.5+Math.sin(chibFrame*0.05),0,0,Math.PI*2); chibCtx.fill();
    chibCtx.beginPath(); chibCtx.ellipse(cx+6,cy-3,3,3.5+Math.sin(chibFrame*0.05),0,0,Math.PI*2); chibCtx.fill();
    chibCtx.fillStyle="#fff";
    chibCtx.beginPath(); chibCtx.ellipse(cx-5,cy-4,1,1,0,0,Math.PI*2); chibCtx.fill();
    chibCtx.beginPath(); chibCtx.ellipse(cx+7,cy-4,1,1,0,0,Math.PI*2); chibCtx.fill();
  }
  // mouth
  chibCtx.strokeStyle="#c0392b"; chibCtx.lineWidth=1.2;
  chibCtx.beginPath();
  if (state==="hover"||state==="celebrate") {
    chibCtx.arc(cx,cy+2,4,0.1,Math.PI-0.1); chibCtx.stroke();
  } else if (state==="click") {
    chibCtx.arc(cx,cy+5,3,Math.PI+0.1,-0.1); chibCtx.stroke();
  } else {
    chibCtx.moveTo(cx-3,cy+2); chibCtx.lineTo(cx+3,cy+2); chibCtx.stroke();
  }
  // blush
  if (state==="hover"||state==="celebrate") {
    chibCtx.fillStyle="rgba(255,100,100,0.25)";
    chibCtx.beginPath(); chibCtx.ellipse(cx-10,cy+1,4,2.5,0,0,Math.PI*2); chibCtx.fill();
    chibCtx.beginPath(); chibCtx.ellipse(cx+10,cy+1,4,2.5,0,0,Math.PI*2); chibCtx.fill();
  }
}

let celebrateTimer = null;
function triggerCelebrate() {
  chibState = "celebrate";
  clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(()=>chibState="idle", 3000);
}

document.addEventListener("mousemove", e => {
  mx = e.clientX; my = e.clientY;
  cursorOuter.style.left = mx+"px";
  cursorOuter.style.top = my+"px";
  document.getElementById("cursor-chibi").style.left = mx+"px";
  document.getElementById("cursor-chibi").style.top = my+"px";
});
document.addEventListener("mousedown", ()=>{ if(chibState!=="celebrate") chibState="click"; });
document.addEventListener("mouseup", ()=>{ if(chibState==="click") chibState="idle"; });
document.querySelectorAll("a,button,input,select,.nav-item").forEach(el=>{
  el.addEventListener("mouseenter", ()=>{ if(chibState==="idle") chibState="hover"; });
  el.addEventListener("mouseleave", ()=>{ if(chibState==="hover") chibState="idle"; });
});

function cursorLoop() {
  chibFrame++;
  drawChibiCursor(chibState);
  requestAnimationFrame(cursorLoop);
}
cursorLoop();

// ===== SIDEBAR CHIBI CANVAS =====
const sbChibi = document.getElementById("sidebar-chibi-canvas");
const sbCtx = sbChibi.getContext("2d");
let sbFrame = 0, sbBob = 0;
function drawSidebarChibi() {
  sbCtx.clearRect(0,0,80,80);
  sbBob = Math.sin(sbFrame*0.04)*3;
  const cx=40, cy=42+sbBob;
  // body
  sbCtx.fillStyle="#1e3a5f";
  sbCtx.beginPath(); sbCtx.ellipse(cx,cy+14,10,12,0,0,Math.PI*2); sbCtx.fill();
  // head
  sbCtx.fillStyle="#ffe4c4";
  sbCtx.beginPath(); sbCtx.ellipse(cx,cy,14,13,0,0,Math.PI*2); sbCtx.fill();
  // hair
  sbCtx.fillStyle="#2d1b69";
  sbCtx.beginPath(); sbCtx.ellipse(cx,cy-11,14,5,0,Math.PI,Math.PI*2); sbCtx.fill();
  sbCtx.beginPath(); sbCtx.ellipse(cx-12,cy-7,4,7,-0.4,0,Math.PI*2); sbCtx.fill();
  sbCtx.beginPath(); sbCtx.ellipse(cx+12,cy-7,4,7,0.4,0,Math.PI*2); sbCtx.fill();
  // eyes
  sbCtx.fillStyle="#1e1b4b";
  sbCtx.beginPath(); sbCtx.ellipse(cx-5,cy-1,3,3.5,0,0,Math.PI*2); sbCtx.fill();
  sbCtx.beginPath(); sbCtx.ellipse(cx+5,cy-1,3,3.5,0,0,Math.PI*2); sbCtx.fill();
  // sparkle
  if (sbFrame%60<10) {
    sbCtx.fillStyle="rgba(108,142,255,0.8)";
    sbCtx.beginPath(); sbCtx.arc(cx+18,cy-16,3,0,Math.PI*2); sbCtx.fill();
  }
  sbFrame++;
  requestAnimationFrame(drawSidebarChibi);
}
drawSidebarChibi();

// ===== HERO CHIBI =====
const heroChibi = document.getElementById("hero-chibi");
const heroCtx = heroChibi.getContext("2d");
let heroFrame = 0;
function drawHeroChibi() {
  heroCtx.clearRect(0,0,160,160);
  const cx=80, cy=90, bob=Math.sin(heroFrame*0.03)*5;
  // glow aura
  const grad = heroCtx.createRadialGradient(cx,cy,10,cx,cy,60);
  grad.addColorStop(0,"rgba(108,142,255,0.15)");
  grad.addColorStop(1,"transparent");
  heroCtx.fillStyle=grad;
  heroCtx.beginPath(); heroCtx.ellipse(cx,cy,60,60,0,0,Math.PI*2); heroCtx.fill();
  // body
  heroCtx.fillStyle="#1e3a5f";
  heroCtx.beginPath(); heroCtx.ellipse(cx,cy+bob+18,16,18,0,0,Math.PI*2); heroCtx.fill();
  // arms wave
  heroCtx.strokeStyle="#1e3a5f"; heroCtx.lineWidth=7; heroCtx.lineCap="round";
  const armAngle = Math.sin(heroFrame*0.06)*0.4;
  heroCtx.beginPath(); heroCtx.moveTo(cx-16,cy+bob+8); heroCtx.lineTo(cx-28,cy+bob-2+Math.sin(armAngle)*8); heroCtx.stroke();
  heroCtx.beginPath(); heroCtx.moveTo(cx+16,cy+bob+8); heroCtx.lineTo(cx+28,cy+bob-2+Math.sin(-armAngle)*8); heroCtx.stroke();
  // head
  heroCtx.fillStyle="#ffe4c4";
  heroCtx.beginPath(); heroCtx.ellipse(cx,cy+bob-4,20,19,0,0,Math.PI*2); heroCtx.fill();
  // hair
  heroCtx.fillStyle="#2d1b69";
  heroCtx.beginPath(); heroCtx.ellipse(cx,cy+bob-20,20,7,0,Math.PI,Math.PI*2); heroCtx.fill();
  heroCtx.beginPath(); heroCtx.ellipse(cx-18,cy+bob-12,5,10,-0.3,0,Math.PI*2); heroCtx.fill();
  heroCtx.beginPath(); heroCtx.ellipse(cx+18,cy+bob-12,5,10,0.3,0,Math.PI*2); heroCtx.fill();
  // eyes
  heroCtx.fillStyle="#1e1b4b";
  heroCtx.beginPath(); heroCtx.ellipse(cx-7,cy+bob-4,4,5,0,0,Math.PI*2); heroCtx.fill();
  heroCtx.beginPath(); heroCtx.ellipse(cx+7,cy+bob-4,4,5,0,0,Math.PI*2); heroCtx.fill();
  heroCtx.fillStyle="#fff";
  heroCtx.beginPath(); heroCtx.ellipse(cx-6,cy+bob-5.5,1.5,1.5,0,0,Math.PI*2); heroCtx.fill();
  heroCtx.beginPath(); heroCtx.ellipse(cx+8,cy+bob-5.5,1.5,1.5,0,0,Math.PI*2); heroCtx.fill();
  // smile
  heroCtx.strokeStyle="#c0392b"; heroCtx.lineWidth=1.5;
  heroCtx.beginPath(); heroCtx.arc(cx,cy+bob+2,5,0.2,Math.PI-0.2); heroCtx.stroke();
  // blush
  heroCtx.fillStyle="rgba(255,100,100,0.2)";
  heroCtx.beginPath(); heroCtx.ellipse(cx-14,cy+bob+1,5,3,0,0,Math.PI*2); heroCtx.fill();
  heroCtx.beginPath(); heroCtx.ellipse(cx+14,cy+bob+1,5,3,0,0,Math.PI*2); heroCtx.fill();
  // sparkles
  [[-25,-30],[22,-38],[30,0],[[-20,10]]].flat().forEach((_, idx, arr) => {
    if (idx%2===0) {
      const sx=cx+arr[idx], sy=cy+arr[idx+1];
      const alpha = Math.sin(heroFrame*0.05+idx)*0.5+0.5;
      heroCtx.fillStyle=`rgba(192,132,252,${(alpha*0.7).toFixed(2)})`;
      heroCtx.beginPath(); heroCtx.arc(sx||cx+20,sy||cy-30,2,0,Math.PI*2); heroCtx.fill();
    }
  });
  heroFrame++;
  requestAnimationFrame(drawHeroChibi);
}
drawHeroChibi();

// ===== GAME (running character) =====
const gc = document.getElementById("game-canvas");
const gCtx = gc.getContext("2d");
let gameScore = 0, gameFrame = 0;
let charY = 50, charVY = 0, isJumping = false;
const GROUND = 52, JUMP_V = -11, GRAVITY = 0.55, CHAR_X = 40;
let obstacles = [], obstacleTimer = 0, obstacleInterval = 120;
let gameOver = false, gameSpeed = 3;

function spawnObstacle() {
  const h = 12 + Math.random()*18;
  obstacles.push({x: gc.width+10, w:10, h, y: GROUND-h});
}

function resetGame() {
  gameScore=0; gameFrame=0; charY=GROUND; charVY=0; isJumping=false;
  obstacles=[]; obstacleTimer=0; gameOver=false; gameSpeed=3;
  document.getElementById("game-score").textContent="0";
}

function gameJump() {
  if (!isJumping) { charVY=JUMP_V; isJumping=true; }
}

gc.addEventListener("click", ()=>{ if(gameOver) resetGame(); else gameJump(); });
document.addEventListener("keydown", e=>{ if(e.code==="Space"){ e.preventDefault(); if(gameOver) resetGame(); else gameJump(); } });

function drawGameChar(x,y,frame) {
  gCtx.save();
  const run = Math.floor(frame/8)%2;
  // body
  gCtx.fillStyle="#2d1b69";
  gCtx.fillRect(x-6,y-20,12,14);
  // head
  gCtx.fillStyle="#ffe4c4";
  gCtx.beginPath(); gCtx.ellipse(x,y-26,8,8,0,0,Math.PI*2); gCtx.fill();
  // hair
  gCtx.fillStyle="#1e1b4b";
  gCtx.beginPath(); gCtx.ellipse(x,y-32,8,4,0,Math.PI,Math.PI*2); gCtx.fill();
  // eyes
  gCtx.fillStyle="#fff";
  gCtx.beginPath(); gCtx.ellipse(x-3,y-27,2,2.5,0,0,Math.PI*2); gCtx.fill();
  gCtx.beginPath(); gCtx.ellipse(x+3,y-27,2,2.5,0,0,Math.PI*2); gCtx.fill();
  gCtx.fillStyle="#1e1b4b";
  gCtx.beginPath(); gCtx.ellipse(x-2.5,y-27,1.2,1.5,0,0,Math.PI*2); gCtx.fill();
  gCtx.beginPath(); gCtx.ellipse(x+3.5,y-27,1.2,1.5,0,0,Math.PI*2); gCtx.fill();
  // legs running
  gCtx.fillStyle="#2d1b69";
  if (isJumping) {
    gCtx.fillRect(x-6,y-8,5,10); gCtx.fillRect(x+1,y-8,5,10);
  } else {
    if (run===0) { gCtx.fillRect(x-6,y-8,5,12); gCtx.fillRect(x+1,y-8,5,8); }
    else { gCtx.fillRect(x-6,y-8,5,8); gCtx.fillRect(x+1,y-8,5,12); }
  }
  gCtx.restore();
}

function gameLoop() {
  gCtx.clearRect(0,0,gc.width,gc.height);
  // bg
  gCtx.fillStyle="#070b14";
  gCtx.fillRect(0,0,gc.width,gc.height);
  // ground
  gCtx.strokeStyle="rgba(108,142,255,0.3)"; gCtx.lineWidth=1.5;
  gCtx.beginPath(); gCtx.moveTo(0,GROUND+4); gCtx.lineTo(gc.width,GROUND+4); gCtx.stroke();
  // stars
  gCtx.fillStyle="rgba(255,255,255,0.4)";
  for (let s=0;s<8;s++) {
    const sx=(s*137+gameFrame*0.3)%gc.width, sy=8+s*7;
    gCtx.beginPath(); gCtx.arc(sx,sy,0.8,0,Math.PI*2); gCtx.fill();
  }

  if (!gameOver) {
    gameFrame++;
    gameSpeed = 3 + Math.floor(gameScore/200)*0.5;
    gameScore += Math.round(gameSpeed/3);
    document.getElementById("game-score").textContent = gameScore;
    // physics
    charVY += GRAVITY; charY += charVY;
    if (charY >= GROUND) { charY=GROUND; charVY=0; isJumping=false; }
    // obstacles
    obstacleTimer++;
    if (obstacleTimer >= obstacleInterval) { spawnObstacle(); obstacleTimer=0; obstacleInterval=80+Math.random()*80; }
    obstacles.forEach(o=>o.x-=gameSpeed);
    obstacles = obstacles.filter(o=>o.x>-20);
    // collision
    obstacles.forEach(o=>{
      if (CHAR_X+7>o.x && CHAR_X-7<o.x+o.w && charY-2>o.y && charY-20<o.y+o.h) {
        gameOver=true;
      }
    });
  }
  // draw obstacles
  obstacles.forEach(o=>{
    gCtx.fillStyle="#c084fc";
    gCtx.fillRect(o.x,o.y,o.w,o.h);
    // evil face
    gCtx.fillStyle="#fff"; gCtx.font="7px sans-serif"; gCtx.textAlign="center";
    gCtx.fillText("👿",o.x+o.w/2,o.y+o.h/2+3);
  });
  // char
  drawGameChar(CHAR_X, charY, gameFrame);
  // game over
  if (gameOver) {
    gCtx.fillStyle="rgba(0,0,0,0.55)";
    gCtx.fillRect(gc.width/2-80,20,160,36);
    gCtx.fillStyle="#f87171"; gCtx.font="bold 13px 'Inter'"; gCtx.textAlign="center";
    gCtx.fillText(`Game Over! Score: ${gameScore}`,gc.width/2,40);
    gCtx.fillStyle="#94a3b8"; gCtx.font="10px 'Inter'";
    gCtx.fillText("Klik / SPACE untuk main lagi",gc.width/2,52);
  }
  requestAnimationFrame(gameLoop);
}
gameLoop();

// ===== INIT DEFAULT DATA =====
function loadDefaultData() {
  kriteriaList = DEFAULT_KRITERIA.map(k=>({...k}));
  alternatifList = DEFAULT_ALTERNATIF.map(a=>({...a}));
  DEFAULT_MATRIKS.forEach((row, ai) => {
    row.forEach((val, ki) => { matriksNilai[`${ai}-${ki}`] = val; });
  });
  document.getElementById("input-nama").value = "Ranking Anime Pilihan 2025";
  document.getElementById("input-metode").value = "TOPSIS";
  renderKriteria();
  renderAlternatif();
}
loadDefaultData();
updateApiUrl();
