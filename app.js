const API = ""; // backend di host yang sama. Kalau backend beda domain, isi misal "https://dss-backend.up.railway.app"

// ---------- STATE ----------
let kriteriaList = [];   // {nama, bobot, tipe}
let alternatifList = []; // {nama}

// ---------- TAB SWITCH ----------
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "riwayat") muatRiwayat();
  });
});

// ---------- KRITERIA ----------
function renderKriteria() {
  const tbody = document.querySelector("#tabel-kriteria tbody");
  tbody.innerHTML = "";
  kriteriaList.forEach((k, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" value="${k.nama}" data-i="${i}" data-f="nama" class="kr-input"></td>
      <td><input type="number" step="0.01" min="0" max="1" value="${k.bobot}" data-i="${i}" data-f="bobot" class="kr-input" style="width:90px"></td>
      <td>
        <select data-i="${i}" data-f="tipe" class="kr-input">
          <option value="benefit" ${k.tipe === "benefit" ? "selected" : ""}>Benefit (semakin besar semakin baik)</option>
          <option value="cost" ${k.tipe === "cost" ? "selected" : ""}>Cost (semakin kecil semakin baik)</option>
        </select>
      </td>
      <td><button class="btn-remove" data-i="${i}" data-action="remove-kriteria">Hapus</button></td>
    `;
    tbody.appendChild(tr);
  });
  hitungTotalBobot();
  renderMatriks();
}

function hitungTotalBobot() {
  const total = kriteriaList.reduce((s, k) => s + (parseFloat(k.bobot) || 0), 0);
  const el = document.getElementById("total-bobot");
  el.textContent = total.toFixed(2);
  el.style.color = Math.abs(total - 1.0) < 0.01 ? "var(--good)" : "#b54040";
}

document.getElementById("btn-tambah-kriteria").addEventListener("click", () => {
  kriteriaList.push({ nama: "", bobot: 0, tipe: "benefit" });
  renderKriteria();
});

document.querySelector("#tabel-kriteria tbody").addEventListener("input", (e) => {
  const i = e.target.dataset.i, f = e.target.dataset.f;
  if (i === undefined) return;
  kriteriaList[i][f] = f === "bobot" ? parseFloat(e.target.value) || 0 : e.target.value;
  if (f === "bobot") hitungTotalBobot();
  if (f === "nama") renderMatriks(); // update header matriks
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
      <td><input type="text" value="${a.nama}" data-i="${i}" class="alt-input"></td>
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

// ---------- MATRIKS NILAI ----------
let matriksNilai = {}; // key "altIdx-kritIdx" -> nilai

function renderMatriks() {
  const wrapper = document.getElementById("matriks-wrapper");
  if (kriteriaList.length === 0 || alternatifList.length === 0) {
    wrapper.innerHTML = '<p class="hint">Belum ada kriteria/alternatif.</p>';
    return;
  }
  let html = '<table class="grid-table"><thead><tr><th>Alternatif</th>';
  kriteriaList.forEach(k => { html += `<th>${k.nama || "(tanpa nama)"}</th>`; });
  html += "</tr></thead><tbody>";
  alternatifList.forEach((a, ai) => {
    html += `<tr><td>${a.nama || "(tanpa nama)"}</td>`;
    kriteriaList.forEach((k, ki) => {
      const key = `${ai}-${ki}`;
      const val = matriksNilai[key] ?? "";
      html += `<td><input type="number" step="any" value="${val}" data-ai="${ai}" data-ki="${ki}" class="mtx-input"></td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  wrapper.innerHTML = html;

  wrapper.querySelectorAll(".mtx-input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const key = `${e.target.dataset.ai}-${e.target.dataset.ki}`;
      matriksNilai[key] = parseFloat(e.target.value) || 0;
    });
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

  const matriks = [];
  for (let ai = 0; ai < alternatifList.length; ai++) {
    for (let ki = 0; ki < kriteriaList.length; ki++) {
      const key = `${ai}-${ki}`;
      matriks.push({ alternatif_index: ai, kriteria_index: ki, nilai: matriksNilai[key] ?? 0 });
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

    statusEl.textContent = "Berhasil dihitung dan disimpan.";
    statusEl.className = "status-msg success";

    document.getElementById("hasil-card").style.display = "block";
    const tbody = document.querySelector("#tabel-hasil tbody");
    tbody.innerHTML = "";
    data.hasil.forEach(h => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${h.ranking}</td><td>${h.alternatif_nama}</td><td>${h.skor.toFixed(4)}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = "status-msg error";
  }
});

// ---------- RIWAYAT ----------
async function muatRiwayat() {
  const tbody = document.querySelector("#tabel-riwayat tbody");
  tbody.innerHTML = '<tr><td colspan="4">Memuat...</td></tr>';
  try {
    const res = await fetch(`${API}/api/studi-kasus`);
    const data = await res.json();
    tbody.innerHTML = "";
    data.forEach(s => {
      const tr = document.createElement("tr");
      const tanggal = new Date(s.dibuat_pada).toLocaleString("id-ID");
      tr.innerHTML = `
        <td>${s.nama}</td><td>${s.metode}</td><td>${tanggal}</td>
        <td><button class="btn-ghost" data-id="${s.id}" data-action="lihat">Lihat hasil</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">Gagal memuat: ${err.message}</td></tr>`;
  }
}

document.querySelector("#tabel-riwayat tbody").addEventListener("click", async (e) => {
  if (e.target.dataset.action === "lihat") {
    const id = e.target.dataset.id;
    const res = await fetch(`${API}/api/studi-kasus/${id}`);
    const data = await res.json();
    document.getElementById("riwayat-detail-card").style.display = "block";
    document.getElementById("riwayat-detail-title").textContent = `Hasil — ${data.nama} (${data.metode})`;
    const tbody = document.querySelector("#tabel-riwayat-detail tbody");
    tbody.innerHTML = "";
    data.hasil.forEach(h => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${h.ranking}</td><td>${h.alternatif_nama}</td><td>${h.skor.toFixed(4)}</td>`;
      tbody.appendChild(tr);
    });
  }
});

document.getElementById("btn-refresh-riwayat").addEventListener("click", muatRiwayat);

// ---------- INIT ----------
renderKriteria();
renderAlternatif();
