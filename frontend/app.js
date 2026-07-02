/* Ado's BI — app.js (complete rewrite) */
const API = "";
// © Ado's BI — dibuat oleh Nathalie

// ===== DEVICE ID (riwayat per-device) =====
// Tiap browser/device dapat 1 ID acak yang disimpan permanen di localStorage.
// Semua request ke /api/studi-kasus* mengirim ID ini lewat header X-Device-Id,
// jadi tiap device hanya melihat riwayat studi kasusnya sendiri.
function getDeviceId(){
  let id=localStorage.getItem("ado-device-id");
  if(!id){
    id=(crypto.randomUUID?crypto.randomUUID():("dev-"+Date.now()+"-"+Math.random().toString(16).slice(2)));
    localStorage.setItem("ado-device-id",id);
  }
  return id;
}
const DEVICE_ID=getDeviceId();
async function apiFetch(url,opts={}){
  const headers=Object.assign({"X-Device-Id":DEVICE_ID},opts.headers||{});
  return fetch(url,{...opts,headers});
}

// ===== ASET KARAKTER ADO (gambar asli, bukan gambar tangan lagi) =====
const ADO_IMG={};
function loadAdoAsset(key,src){
  const img=new Image();img.src=src;ADO_IMG[key]=img;return img;
}
loadAdoAsset("bust","/static/assets/ado/ado_bust.png");
loadAdoAsset("bustDark","/static/assets/ado/ado_bust_dark.png"); // versi mode gelap: rumus/kalkulator di atas kepala jadi putih
loadAdoAsset("face","/static/assets/ado/ado_face.png");
loadAdoAsset("faceDark","/static/assets/ado/ado_face_dark.png"); // idem, buat avatar profil mini
loadAdoAsset("angry","/static/assets/ado/ado_angry.png");
loadAdoAsset("hero","/static/assets/ado/ado_hero.png");
loadAdoAsset("pixelGame","/static/assets/ado/ado_pixel_game.png");
loadAdoAsset("pixelCur","/static/assets/ado/ado_pixel_cursor.png");
loadAdoAsset("curSmile","/static/assets/ado/ado_smile.png");   // kursor idle/hover — ekspresi senyum
loadAdoAsset("curPout","/static/assets/ado/ado_pout.png");     // kursor klik — ekspresi manyun
loadAdoAsset("logoMark","/static/assets/ado/ado_logo.png");    // logo sidebar (wordmark "ado'sbi")
loadAdoAsset("wiSmile","/static/assets/ado/ado_wi_smile.png"); // ekspresi What-If: bobot pas
loadAdoAsset("wiPout","/static/assets/ado/ado_wi_pout.png");   // ekspresi What-If: bobot belum pas
loadAdoAsset("wiAngry","/static/assets/ado/ado_wi_angry.png"); // ekspresi What-If: bobot kelebihan
loadAdoAsset("onboard","/static/assets/ado/ado_onboard.png");  // mascot di tour/onboarding — full body, biar HD & jelas

// Setup canvas beresolusi tinggi (HD) — backing buffer digandakan sesuai
// devicePixelRatio (minimal 2x) supaya gambar foto Ado nggak buram/pecah di
// layar retina/HiDPI, sementara ukuran tampilnya di layar tetap sama.
function hiDPICanvas(canvas,cssW,cssH){
  const dpr=Math.max(window.devicePixelRatio||1,2);
  canvas.width=Math.round(cssW*dpr);
  canvas.height=Math.round(cssH*dpr);
  canvas.style.width=cssW+"px";
  canvas.style.height=cssH+"px";
  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}

function drawContain(ctx,img,cw,ch,pad,smoothing){
  if(pad===undefined)pad=0;
  if(smoothing===undefined)smoothing=true;
  if(!img.complete||!img.naturalWidth){return false;}
  ctx.imageSmoothingEnabled=smoothing;
  const availW=cw-pad*2, availH=ch-pad*2;
  const scale=Math.min(availW/img.naturalWidth, availH/img.naturalHeight);
  const w=img.naturalWidth*scale, h=img.naturalHeight*scale;
  ctx.drawImage(img,(cw-w)/2,(ch-h)/2,w,h);
  return true;
}

// STATE
let kriteriaList=[], alternatifList=[], matriksNilai={};
let lastHasil=null, lastRiwayat=null, allRiwayat=[];
let currentUser=null, pbiToken=null;
let chartHasil=null, chartRiw=null, chartWI=null;
let wiData=null, isDark=true, _lastProfileState="anon";

// DEFAULT DATA
const DEF_K=[
  {nama:"Story / Plot",bobot:.30,tipe:"benefit"},
  {nama:"Animation Quality",bobot:.25,tipe:"benefit"},
  {nama:"Soundtrack / OST",bobot:.25,tipe:"benefit"},
  {nama:"Harga Nonton ($/bl)",bobot:.20,tipe:"cost"}
];
const DEF_A=[{nama:"Attack on Titan"},{nama:"Demon Slayer"},{nama:"Jujutsu Kaisen"},{nama:"Spy x Family"},{nama:"Oshi no Ko"}];
const DEF_M=[[9.5,9.0,9.2,15],[9.0,9.8,9.5,13],[8.8,9.5,8.7,13],[8.5,8.8,8.5,10],[9.2,9.0,9.0,12]];

// ===== TOAST =====
// Catatan: toast TIDAK lagi hilang otomatis (dulu fade-out sendiri abis 3.2 detik,
// keliatan jelek kalau lagi nunjukkin hasil hitung/simulasi/riwayat). Sekarang toast
// tetap nongol sampai usernya sendiri yang klik tombol ✕ — tetap interaktif, tapi
// visualnya nggak ujug-ujug menghilang.
function toast(msg,type=""){
  const t=document.getElementById("toast");
  document.getElementById("toast-text").textContent=msg;
  t.className="toast "+type+" show";
  const icon=document.getElementById("toast-icon");
  if(type==="error"||type==="success"){
    icon.style.display="block";
    const ix=hiDPICanvas(icon,28,28);
    ix.save();ix.beginPath();ix.arc(14,14,14,0,Math.PI*2);ix.clip();
    ix.fillStyle=isDark?"#1c2a45":"#e8eeff";ix.fillRect(0,0,28,28);
    const img=type==="error"?ADO_IMG.angry:ADO_IMG.curSmile;
    drawContain(ix,img,28,28,1);
    ix.restore();
  } else {
    icon.style.display="none";
  }
}
document.getElementById("toast-close").addEventListener("click",()=>{
  document.getElementById("toast").classList.remove("show");
});

// ===== THEME =====
function applyTheme(dark){
  isDark=dark;
  document.documentElement.setAttribute("data-theme",dark?"dark":"light");
  document.getElementById("theme-icon").textContent=dark?"🌙":"☀️";
  localStorage.setItem("ado-theme",dark?"dark":"light");
  if(typeof renderProfileCanvas==="function")renderProfileCanvas(_lastProfileState);
}
document.getElementById("theme-toggle").addEventListener("click",()=>applyTheme(!isDark));
applyTheme(localStorage.getItem("ado-theme")!=="light");

// ===== SERVER STATUS =====
async function checkSrv(){
  const dot=document.getElementById("srv-dot"), lbl=document.getElementById("srv-lbl");
  try{const r=await fetch(`${API}/api/health`);dot.className=r.ok?"srv-dot ok":"srv-dot err";lbl.textContent=r.ok?"Online":"Error";}
  catch{dot.className="srv-dot err";lbl.textContent="Offline";}
}
checkSrv(); setInterval(checkSrv,30000);

// ===== SIDEBAR / TABS =====
const PAGES={baru:"Studi Kasus Baru",riwayat:"Riwayat",whatif:"What-If Analysis",export:"Export & Power BI",test:"Unit Test"};
const SPEECHES={baru:"Ayo mulai analisis~!",riwayat:"Cek riwayatmu~",whatif:"Coba simulasi dulu!",export:"Download datanya~",test:"Mari test algoritmanya!"};
document.getElementById("menu-btn").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
document.querySelectorAll(".nav-item[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".nav-item[data-tab]").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
  btn.classList.add("active");
  const tab=btn.dataset.tab;
  document.getElementById("tab-"+tab).classList.add("active");
  document.getElementById("tb-page").textContent=PAGES[tab];
  document.getElementById("sb-speech").textContent=SPEECHES[tab]||"Ganbare!";
  if(tab==="riwayat")loadRiwayat();
  if(tab==="export")document.getElementById("api-url").textContent=location.origin+"/api/studi-kasus";
  if(tab==="whatif")fillWISelect();
  if(window.innerWidth<=768)document.getElementById("sidebar").classList.remove("open");
}));

// ===== PROFILE DROPDOWN =====
const pdEl=document.getElementById("profile-dropdown");
document.getElementById("profile-btn").addEventListener("click",e=>{
  e.stopPropagation();
  pdEl.style.display=pdEl.style.display==="none"?"block":"none";
});
document.addEventListener("click",e=>{if(!pdEl.contains(e.target)&&e.target!==document.getElementById("profile-btn"))pdEl.style.display="none";});

// ===== AUTH =====
function renderProfileCanvas(state){
  _lastProfileState=state;
  const c=document.getElementById("profile-canvas"), x=c.getContext("2d");
  x.clearRect(0,0,32,32);
  if(state==="anon"){
    x.fillStyle=isDark?"#1c2a45":"#e8eeff";
    x.beginPath();x.arc(16,16,15,0,Math.PI*2);x.fill();
    x.strokeStyle=isDark?"#2a3d60":"#b8c4e8";x.lineWidth=1.5;x.stroke();
    x.fillStyle=isDark?"#6c8eff":"#4a6cf0";
    x.font="bold 16px Cinzel,serif";x.textAlign="center";x.textBaseline="middle";
    x.fillText("?",16,16);
  } else {
    x.fillStyle=isDark?"#1c2a45":"#e8eeff";
    x.beginPath();x.arc(16,16,15,0,Math.PI*2);x.fill();
    drawMiniChibi(x,16,16,10,state);
  }
}

function drawMiniChibi(ctx,cx,cy,r){
  ctx.save();
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
  const img=isDark?ADO_IMG.faceDark:ADO_IMG.face;
  if(img&&img.complete&&img.naturalWidth){
    ctx.imageSmoothingEnabled=true;
    const scale=Math.max((r*3.1)/img.naturalWidth,(r*3.1)/img.naturalHeight);
    const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    ctx.drawImage(img,cx-w/2,cy-h/2+r*.18,w,h);
  }
  ctx.restore();
}

function setLoggedIn(name,email,provider){
  currentUser={name,email,provider};
  document.getElementById("pd-logged-out").style.display="none";
  document.getElementById("pd-logged-in").style.display="block";
  document.getElementById("pd-name").textContent=name;
  document.getElementById("pd-email").textContent=email;
  if(provider==="microsoft"){
    pbiToken="pbi_"+Date.now();
    document.getElementById("pbi-login-area").style.display="none";
    document.getElementById("pbi-area").style.display="block";
    document.getElementById("pbi-uname").textContent=name;
    document.getElementById("pbi-dot").className="pdot on";
    document.getElementById("pbi-stxt").textContent="Terhubung ke Power BI";
  }
  const av=document.getElementById("pd-avatar"), ax=av.getContext("2d");
  ax.clearRect(0,0,40,40);
  ax.fillStyle=isDark?"#1c2a45":"#e8eeff";ax.beginPath();ax.arc(20,20,19,0,Math.PI*2);ax.fill();
  drawMiniChibi(ax,20,20,13,"happy");
  renderProfileCanvas("happy");
  document.getElementById("sb-speech").textContent=`Halo ${name}~ Ayo mulai!`;
  toast(`Login sebagai ${name} ✓`,"success");
}
function setLoggedOut(){
  currentUser=null;pbiToken=null;
  document.getElementById("pd-logged-out").style.display="block";
  document.getElementById("pd-logged-in").style.display="none";
  document.getElementById("pbi-login-area").style.display="block";
  document.getElementById("pbi-area").style.display="none";
  document.getElementById("pbi-dot").className="pdot";
  document.getElementById("pbi-stxt").textContent="Belum terhubung";
  renderProfileCanvas("anon");toast("Berhasil logout.","");
}
function doLogin(provider){
  window.location.href = provider==="google" ? "/auth/google/login" : "/auth/microsoft/login";
}
document.getElementById("pd-google").addEventListener("click",()=>doLogin("google"));
document.getElementById("pd-ms").addEventListener("click",()=>doLogin("microsoft"));
document.getElementById("pbi-ms-login").addEventListener("click",()=>doLogin("microsoft"));
document.getElementById("pd-logout").addEventListener("click",async()=>{
  try{await fetch("/auth/logout",{method:"POST"});}catch{}
  setLoggedOut();pdEl.style.display="none";
});

async function checkAuthSession(){
  try{
    const r=await fetch("/auth/me");
    const d=await r.json();
    if(d.logged_in){
      setLoggedIn(d.name||d.email,d.email,d.provider);
      if(d.provider==="microsoft"&&d.pbi_connected){
        document.getElementById("pbi-login-area").style.display="none";
        document.getElementById("pbi-area").style.display="block";
        document.getElementById("pbi-uname").textContent=d.name||d.email;
        document.getElementById("pbi-dot").className="pdot on";
        document.getElementById("pbi-stxt").textContent="Terhubung ke Power BI";
      }
    }
  }catch{}
}
(function handleAuthRedirectParams(){
  const p=new URLSearchParams(location.search);
  if(p.get("login_success")){toast("Login berhasil \u2713","success");}
  if(p.get("login_error")){toast(decodeURIComponent(p.get("login_error")).replace(/\+/g," "),"error");}
  if(p.has("login_success")||p.has("login_error")){
    p.delete("login_success");p.delete("login_error");
    const qs=p.toString();
    history.replaceState({},"",location.pathname+(qs?`?${qs}`:""));
  }
})();
checkAuthSession();
document.getElementById("pd-history").addEventListener("click",()=>{
  document.querySelector('.nav-item[data-tab="riwayat"]').click();pdEl.style.display="none";
});
document.getElementById("pd-export-btn").addEventListener("click",()=>{
  document.querySelector('.nav-item[data-tab="export"]').click();pdEl.style.display="none";
});
renderProfileCanvas("anon");

// ===== ALGORITHMS =====
function saw(mat,krit){
  const nA=mat.length,nK=krit.length,norm=mat.map(()=>new Array(nK).fill(0));
  for(let j=0;j<nK;j++){
    const col=mat.map(r=>r[j]);
    if(krit[j].tipe==="benefit"){const mx=Math.max(...col);for(let i=0;i<nA;i++)norm[i][j]=mx?mat[i][j]/mx:0;}
    else{const mn=Math.min(...col);for(let i=0;i<nA;i++)norm[i][j]=mat[i][j]?mn/mat[i][j]:0;}
  }
  return norm.map(row=>row.reduce((s,v,j)=>s+v*krit[j].bobot,0));
}
function topsis(mat,krit){
  const nA=mat.length,nK=krit.length,norm=mat.map(()=>new Array(nK).fill(0));
  for(let j=0;j<nK;j++){const d=Math.sqrt(mat.reduce((s,r)=>s+r[j]**2,0));for(let i=0;i<nA;i++)norm[i][j]=d?mat[i][j]/d:0;}
  const w=norm.map(row=>row.map((v,j)=>v*krit[j].bobot));
  const Ap=[],An=[];
  for(let j=0;j<nK;j++){const col=w.map(r=>r[j]);if(krit[j].tipe==="benefit"){Ap.push(Math.max(...col));An.push(Math.min(...col));}else{Ap.push(Math.min(...col));An.push(Math.max(...col));}}
  return w.map(row=>{const dp=Math.sqrt(row.reduce((s,v,j)=>s+(v-Ap[j])**2,0)),dn=Math.sqrt(row.reduce((s,v,j)=>s+(v-An[j])**2,0));return(dp+dn)?dn/(dp+dn):0;});
}
function calcAndRank(mat2d,kritDict,metode,altNames){
  const skor=metode==="SAW"?saw(mat2d,kritDict):topsis(mat2d,kritDict);
  const ord=[...Array(skor.length).keys()].sort((a,b)=>skor[b]-skor[a]);
  const rm={};ord.forEach((idx,pos)=>rm[idx]=pos+1);
  return altNames.map((nm,i)=>({alternatif_nama:nm,skor:Math.round(skor[i]*1e6)/1e6,ranking:rm[i]})).sort((a,b)=>a.ranking-b.ranking);
}

// ===== RENDER TABLE =====
function renderTable(tbody,hasil){
  tbody.innerHTML="";
  const mx=Math.max(...hasil.map(h=>h.skor));
  hasil.forEach(h=>{
    const rc=h.ranking===1?"r1":h.ranking===2?"r2":h.ranking===3?"r3":"";
    const pct=mx>0?(h.skor/mx*100).toFixed(1):0;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><span class="rank-b ${rc}">${h.ranking}</span></td><td style="font-weight:600">${h.alternatif_nama}</td><td style="font-family:'JetBrains Mono',monospace;font-size:12.5px">${h.skor.toFixed(4)}</td><td><div class="sbar"><div class="sbar-f" style="width:${pct}%"></div></div></td>`;
    tbody.appendChild(tr);
  });
}
function renderChart(canvasId,hasil,ref){
  const c=document.getElementById(canvasId);if(!c)return null;
  if(ref)ref.destroy();
  const colors=hasil.map(h=>h.ranking===1?"rgba(251,191,36,.8)":h.ranking===2?"rgba(203,213,225,.7)":h.ranking===3?"rgba(205,133,63,.7)":"rgba(108,142,255,.65)");
  // responsive:false -> ukuran chart TETAP, nggak auto ngecil/gedein sendiri pas layout berubah dikit.
  // Kalau mau resize, atur manual lewat atribut width/height canvas di index.html.
  return new Chart(c,{type:"bar",data:{labels:hasil.map(h=>h.alternatif_nama),datasets:[{label:"Skor",data:hasil.map(h=>h.skor),backgroundColor:colors,borderColor:colors.map(c=>c.replace(/[\d.]+\)$/,"1)")),borderWidth:1.5,borderRadius:5}]},options:{responsive:false,devicePixelRatio:Math.max(window.devicePixelRatio||1,2),plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>" "+ctx.parsed.y.toFixed(4)}}},scales:{x:{ticks:{color:"#94a3b8",font:{size:10.5}},grid:{color:"rgba(255,255,255,0.04)"}},y:{ticks:{color:"#94a3b8",font:{size:10.5}},grid:{color:"rgba(255,255,255,0.05)"},beginAtZero:true}}}});
}

// ===== KRITERIA =====
function renderKriteria(){
  const tb=document.querySelector("#tbl-kriteria tbody");tb.innerHTML="";
  kriteriaList.forEach((k,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><input type="text" value="${k.nama}" data-i="${i}" data-f="nama" placeholder="Nama kriteria"></td><td><input type="number" step="0.01" min="0" max="1" value="${k.bobot}" data-i="${i}" data-f="bobot"></td><td><select data-i="${i}" data-f="tipe"><option value="benefit"${k.tipe==="benefit"?" selected":""}>Benefit — makin besar makin baik</option><option value="cost"${k.tipe==="cost"?" selected":""}>Cost — makin kecil makin baik</option></select></td><td><button class="btn-remove" data-i="${i}" data-a="rmk">✕</button></td>`;
    tb.appendChild(tr);
  });
  updateBBar("bbar-fill","total-bobot",kriteriaList);renderMatriks();
}
function updateBBar(fid,vid,list){
  const total=list.reduce((s,k)=>s+(parseFloat(k.bobot)||0),0);
  const f=document.getElementById(fid),v=document.getElementById(vid);
  if(!f||!v)return;
  f.style.width=Math.min(total*100,100)+"%";v.textContent=total.toFixed(2);
  const g=Math.abs(total-1)<.01,o=total>1.01;
  f.className="bbar-fill"+(g?" good":o?" over":"");v.className="bval"+(g?" good":o?" over":"");
}
document.getElementById("btn-add-k").addEventListener("click",()=>{kriteriaList.push({nama:"",bobot:0,tipe:"benefit"});renderKriteria();});
document.querySelector("#tbl-kriteria tbody").addEventListener("input",e=>{
  const i=e.target.dataset.i,f=e.target.dataset.f;if(!i)return;
  kriteriaList[i][f]=f==="bobot"?parseFloat(e.target.value)||0:e.target.value;
  if(f==="bobot")updateBBar("bbar-fill","total-bobot",kriteriaList);
  if(f==="nama")renderMatriks();
});
document.querySelector("#tbl-kriteria tbody").addEventListener("click",e=>{if(e.target.dataset.a==="rmk"){kriteriaList.splice(+e.target.dataset.i,1);renderKriteria();}});

// ===== ALTERNATIF =====
function renderAlt(){
  const tb=document.querySelector("#tbl-alt tbody");tb.innerHTML="";
  alternatifList.forEach((a,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><input type="text" value="${a.nama}" data-i="${i}" placeholder="Nama anime..."></td><td><button class="btn-remove" data-i="${i}" data-a="rma">✕</button></td>`;
    tb.appendChild(tr);
  });
  renderMatriks();
}
document.getElementById("btn-add-a").addEventListener("click",()=>{alternatifList.push({nama:""});renderAlt();});
document.querySelector("#tbl-alt tbody").addEventListener("input",e=>{const i=e.target.dataset.i;if(!i)return;alternatifList[i].nama=e.target.value;renderMatriks();});
document.querySelector("#tbl-alt tbody").addEventListener("click",e=>{if(e.target.dataset.a==="rma"){alternatifList.splice(+e.target.dataset.i,1);renderAlt();}});

// ===== MATRIKS =====
function renderMatriks(){
  const w=document.getElementById("matriks-wrap");
  if(!kriteriaList.length||!alternatifList.length){w.innerHTML='<div class="empty-st"><span>📊</span><p>Isi kriteria dan alternatif dulu ya~</p></div>';return;}
  let h=`<table class="gtable"><thead><tr><th>Anime</th>`;
  kriteriaList.forEach(k=>{h+=`<th>${k.nama||"(?)"}</th>`;});h+=`</tr></thead><tbody>`;
  alternatifList.forEach((a,ai)=>{
    h+=`<tr><td style="font-weight:600">${a.nama||"(?)"}</td>`;
    kriteriaList.forEach((_,ki)=>{const v=matriksNilai[`${ai}-${ki}`]??"";h+=`<td><input type="number" step="any" value="${v}" data-ai="${ai}" data-ki="${ki}" class="mx" placeholder="0"></td>`;});
    h+=`</tr>`;
  });
  h+=`</tbody></table>`;w.innerHTML=h;
  w.querySelectorAll(".mx").forEach(inp=>inp.addEventListener("input",e=>{matriksNilai[`${e.target.dataset.ai}-${e.target.dataset.ki}`]=parseFloat(e.target.value)||0;}));
}

// ===== HITUNG =====
document.getElementById("btn-hitung").addEventListener("click",async()=>{
  const sm=document.getElementById("status-msg");sm.className="smsg";sm.textContent="Menghitung...";
  const nama=document.getElementById("input-nama").value.trim();
  const metode=document.getElementById("input-metode").value;
  const deskripsi=document.getElementById("input-deskripsi").value.trim();
  if(!nama){sm.className="smsg error";sm.textContent="Nama studi kasus wajib diisi.";return;}
  if(!kriteriaList.length){sm.className="smsg error";sm.textContent="Tambahkan minimal 1 kriteria.";return;}
  if(!alternatifList.length){sm.className="smsg error";sm.textContent="Tambahkan minimal 1 alternatif.";return;}
  const tb=kriteriaList.reduce((s,k)=>s+(parseFloat(k.bobot)||0),0);
  if(Math.abs(tb-1)>.01){sm.className="smsg error";sm.textContent=`Total bobot harus 1.0 (sekarang ${tb.toFixed(2)})`;return;}
  const btn=document.getElementById("btn-hitung");btn.disabled=true;
  const mat2d=Array.from({length:alternatifList.length},(_,ai)=>Array.from({length:kriteriaList.length},(_,ki)=>matriksNilai[`${ai}-${ki}`]||0));
  const kritDict=kriteriaList.map(k=>({bobot:parseFloat(k.bobot),tipe:k.tipe}));
  const payload={nama,deskripsi:deskripsi||null,metode,kriteria:kriteriaList.map(k=>({nama:k.nama,bobot:parseFloat(k.bobot),tipe:k.tipe})),alternatif:alternatifList.map(a=>({nama:a.nama})),matriks:alternatifList.flatMap((_,ai)=>kriteriaList.map((_,ki)=>({alternatif_index:ai,kriteria_index:ki,nilai:matriksNilai[`${ai}-${ki}`]||0})))};
  try{
    let data;
    try{
      const r=await apiFetch(`${API}/api/studi-kasus`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      data=await r.json();if(!r.ok)throw new Error(data.detail||"Error");
    }catch(se){
      const hasil=calcAndRank(mat2d,kritDict,metode,alternatifList.map(a=>a.nama));
      data={id:Date.now(),nama,deskripsi,metode,dibuat_pada:new Date().toISOString(),hasil};
      toast("⚠️ Hitung lokal (backend offline)","");
    }
    lastHasil=data;sm.className="smsg success";sm.textContent="✓ Berhasil dihitung!";
    document.getElementById("hasil-card").style.display="block";
    document.getElementById("hasil-title").textContent=`${metode} — ${nama}`;
    renderTable(document.querySelector("#tbl-hasil tbody"),data.hasil);
    chartHasil=renderChart("hasil-chart",data.hasil,chartHasil);
    document.getElementById("hasil-card").scrollIntoView({behavior:"smooth",block:"nearest"});
    triggerCelebrate();toast("🎉 "+data.hasil[0].alternatif_nama+" ranking #1!","success");
  }catch(err){sm.className="smsg error";sm.textContent=err.message;toast(err.message,"error");}
  finally{btn.disabled=false;}
});

// ===== RIWAYAT =====
async function loadRiwayat(){
  const tb=document.querySelector("#tbl-riwayat tbody");
  tb.innerHTML='<tr><td colspan="4" class="tdc">Memuat...</td></tr>';
  try{
    const r=await apiFetch(`${API}/api/studi-kasus`),data=await r.json();
    allRiwayat=data;tb.innerHTML="";
    if(!data.length){
      tb.innerHTML=`<tr><td colspan="4"><div class="empty-state">
        <canvas id="empty-chibi" width="72" height="72"></canvas>
        <div class="empty-state-title">Belum ada studi kasus</div>
        <div class="empty-state-sub">Yuk mulai analisis pertamamu di tab "Studi Kasus Baru"~</div>
      </div></td></tr>`;
      const ec=document.getElementById("empty-chibi"),ex=hiDPICanvas(ec,72,72);
      drawContain(ex,ADO_IMG.curPout,72,72,2);
      return;
    }
    data.forEach(s=>{
      const tr=document.createElement("tr");
      const tgl=new Date(s.dibuat_pada).toLocaleString("id-ID");
      const mb=`<span style="background:rgba(108,142,255,.15);color:var(--acc);padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700">${s.metode}</span>`;
      tr.innerHTML=`<td style="font-weight:600">${s.nama}</td><td>${mb}</td><td style="font-size:12px;color:var(--ink2)">${tgl}</td><td><button class="btn-ghost" style="font-size:11.5px;padding:4px 9px" data-id="${s.id}" data-a="lihat">Lihat</button></td>`;
      tb.appendChild(tr);
    });
    fillWISelect();
  }catch(err){tb.innerHTML=`<tr><td colspan="4" class="tdc">Gagal: ${err.message}</td></tr>`;}
}
document.querySelector("#tbl-riwayat tbody").addEventListener("click",async e=>{
  if(e.target.dataset.a==="lihat"){
    try{
      const r=await apiFetch(`${API}/api/studi-kasus/${e.target.dataset.id}`),data=await r.json();
      lastRiwayat=data;
      document.getElementById("riwayat-detail").style.display="block";
      document.getElementById("riwayat-title").textContent=`${data.nama} — ${data.metode}`;
      renderTable(document.querySelector("#tbl-riwayat-detail tbody"),data.hasil);
      chartRiw=renderChart("riwayat-chart",data.hasil,chartRiw);
      document.getElementById("riwayat-detail").scrollIntoView({behavior:"smooth",block:"nearest"});
    }catch(err){toast("Gagal: "+err.message,"error");}
  }
});
document.getElementById("btn-refresh").addEventListener("click",loadRiwayat);

// ===== WHAT-IF =====
async function fillWISelect(){
  // dulu ini cuma baca allRiwayat (yang cuma keisi kalau tab Riwayat udah pernah dibuka).
  // sekarang fetch sendiri kalau datanya belum ada, jadi What-If nggak perlu nunggu tab Riwayat.
  if(!allRiwayat.length){
    try{const r=await apiFetch(`${API}/api/studi-kasus`);allRiwayat=await r.json();}
    catch(err){/* biarin kosong, biar user tetep bisa liat pesan "belum ada data" di select */}
  }
  const s=document.getElementById("wi-sel"),cur=s.value;
  s.innerHTML='<option value="">-- Pilih --</option>';
  allRiwayat.forEach(x=>{const o=document.createElement("option");o.value=x.id;o.textContent=`${x.nama} (${x.metode})`;s.appendChild(o);});
  if(cur)s.value=cur;
}
document.getElementById("wi-sel").addEventListener("change",async function(){
  const id=this.value;if(!id){wiData=null;document.getElementById("wi-sliders").innerHTML="";return;}
  try{const r=await apiFetch(`${API}/api/studi-kasus/${id}`);wiData=await r.json();buildWISliders();}
  catch(err){toast("Gagal load: "+err.message,"error");}
});
function buildWISliders(){
  const w=document.getElementById("wi-sliders");w.innerHTML="";
  const krit=wiData.kriteria||[];
  if(!krit.length){w.innerHTML='<p class="hint">Data kriteria tidak tersedia.</p>';return;}
  krit.forEach((k,i)=>{
    const d=document.createElement("div");d.className="wi-sr";
    d.innerHTML=`<div class="wi-sl-label"><span>${k.nama} <span style="font-size:10px;color:var(--ink3)">(${k.tipe})</span></span><span class="wi-sl-val" id="wv-${i}">${(k.bobot||0).toFixed(2)}</span></div><input type="range" min="0" max="1" step="0.01" value="${k.bobot||0}" data-ki="${i}" id="ws-${i}">`;
    w.appendChild(d);
    document.getElementById(`ws-${i}`).addEventListener("input",function(){document.getElementById(`wv-${i}`).textContent=parseFloat(this.value).toFixed(2);updateWIBar();});
  });
  updateWIBar();
}
// ===== WHAT-IF MASCOT (reaksi Ado, selalu ada, ganti ekspresi sesuai total bobot) =====
const wiChibiC=document.getElementById("wi-chibi"),wiChibiX=hiDPICanvas(wiChibiC,52,52);
let _lastWIMood="neutral";
function drawWIChibi(mood){
  wiChibiX.clearRect(0,0,52,52);
  const img=mood==="good"?ADO_IMG.wiSmile:mood==="over"?ADO_IMG.wiAngry:ADO_IMG.wiPout;
  drawContain(wiChibiX,img,52,52,3);
}
drawWIChibi("neutral");
[ADO_IMG.wiSmile,ADO_IMG.wiAngry,ADO_IMG.wiPout].forEach(img=>img.addEventListener("load",()=>drawWIChibi(_lastWIMood)));

function updateWIBar(){
  if(!wiData?.kriteria)return;
  const vals=wiData.kriteria.map((_,i)=>{const s=document.getElementById(`ws-${i}`);return s?parseFloat(s.value)||0:0;});
  const total=vals.reduce((s,v)=>s+v,0);
  const f=document.getElementById("wi-bbar"),v=document.getElementById("wi-total");
  if(!f||!v)return;
  f.style.width=Math.min(total*100,100)+"%";v.textContent=total.toFixed(2);
  const g=Math.abs(total-1)<.01,o=total>1.01;
  f.className="bbar-fill"+(g?" good":o?" over":"");v.className="bval"+(g?" good":o?" over":"");
  const mood=g?"good":o?"over":"neutral";
  _lastWIMood=mood;drawWIChibi(mood);
  const msg=document.getElementById("wi-chibi-msg");
  if(msg)msg.textContent=g?"Pas banget, siap disimulasikan!":o?"Kelebihan tuh, kurangin dikit~":"Atur sampai totalnya 1.0 ya~";
}
document.getElementById("btn-wi").addEventListener("click",async()=>{
  if(!wiData){toast("Pilih studi kasus dulu!","error");return;}
  const krit=wiData.kriteria||[];if(!krit.length){toast("Data kriteria tidak tersedia.","error");return;}
  const baru=krit.map((_,i)=>{const s=document.getElementById(`ws-${i}`);return s?parseFloat(s.value)||0:0;});
  const total=baru.reduce((s,v)=>s+v,0);
  if(Math.abs(total-1)>.01){toast(`Total bobot harus 1.0 (${total.toFixed(2)})`,"error");return;}
  try{
    const r=await apiFetch(`${API}/api/studi-kasus/${wiData.id}`),full=await r.json();
    const nA=(full.alternatif||[]).length,nK=(full.kriteria||[]).length;
    const mat=Array.from({length:nA},(_,ai)=>Array.from({length:nK},(_,ki)=>{const n=(full.nilai||[]).find(x=>x.alternatif_index===ai&&x.kriteria_index===ki);return n?n.nilai:0;}));
    const kd=krit.map((k,i)=>({bobot:baru[i],tipe:k.tipe}));
    const metode=wiData.metode||"SAW";
    const hasil=calcAndRank(mat,kd,metode,(full.alternatif||[]).map(a=>a.nama));
    renderTable(document.querySelector("#tbl-wi tbody"),hasil);
    chartWI=renderChart("wi-chart",hasil,chartWI);
    toast("Simulasi selesai! 🎛️","success");
  }catch(err){toast("Error: "+err.message,"error");}
});

// ===== EXPORT UTILS =====
function toCSV(data){
  const rows=[["Ranking","Alternatif","Skor","Metode","Studi Kasus"]];
  data.hasil.forEach(h=>rows.push([h.ranking,`"${h.alternatif_nama}"`,h.skor.toFixed(6),data.metode,`"${data.nama}"`]));
  return rows.map(r=>r.join(",")).join("\n");
}
function toXLSX(data){
  // Simple Excel XML format (readable by Excel/LibreOffice)
  let xml=`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Hasil"><Table><Row><Cell><Data ss:Type="String">Ranking</Data></Cell><Cell><Data ss:Type="String">Alternatif</Data></Cell><Cell><Data ss:Type="String">Skor</Data></Cell><Cell><Data ss:Type="String">Metode</Data></Cell><Cell><Data ss:Type="String">Studi Kasus</Data></Cell></Row>`;
  data.hasil.forEach(h=>{xml+=`<Row><Cell><Data ss:Type="Number">${h.ranking}</Data></Cell><Cell><Data ss:Type="String">${h.alternatif_nama}</Data></Cell><Cell><Data ss:Type="Number">${h.skor.toFixed(6)}</Data></Cell><Cell><Data ss:Type="String">${data.metode}</Data></Cell><Cell><Data ss:Type="String">${data.nama}</Data></Cell></Row>`;});
  xml+=`</Table></Worksheet></Workbook>`;return xml;
}
function dlFile(content,name,mime){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type:mime}));a.download=name;a.click();}

document.getElementById("exp-csv-res").addEventListener("click",()=>{if(!lastHasil){toast("Belum ada hasil.","error");return;}dlFile(toCSV(lastHasil),`DSS_${lastHasil.nama}.csv`,"text/csv");toast("CSV diunduh ✓","success");});
document.getElementById("exp-xlsx-res").addEventListener("click",()=>{if(!lastHasil){toast("Belum ada hasil.","error");return;}dlFile(toXLSX(lastHasil),`DSS_${lastHasil.nama}.xls`,"application/vnd.ms-excel");toast("Excel diunduh ✓","success");});
document.getElementById("exp-csv-riw").addEventListener("click",()=>{if(!lastRiwayat){toast("Pilih riwayat dulu.","error");return;}dlFile(toCSV(lastRiwayat),`DSS_${lastRiwayat.nama}.csv`,"text/csv");toast("CSV diunduh ✓","success");});
document.getElementById("exp-xlsx-riw").addEventListener("click",()=>{if(!lastRiwayat){toast("Pilih riwayat dulu.","error");return;}dlFile(toXLSX(lastRiwayat),`DSS_${lastRiwayat.nama}.xls`,"application/vnd.ms-excel");toast("Excel diunduh ✓","success");});

async function expAll(fmt){
  try{
    const r=await apiFetch(`${API}/api/studi-kasus`),list=await r.json();
    if(!list.length){toast("Belum ada data.","error");return;}
    const details=await Promise.all(list.map(s=>apiFetch(`${API}/api/studi-kasus/${s.id}`).then(r=>r.json())));
    if(fmt==="csv"){
      const rows=[["ID","Nama","Metode","Dibuat","Ranking","Alternatif","Skor"]];
      details.forEach(d=>d.hasil.forEach(h=>rows.push([d.id,`"${d.nama}"`,d.metode,d.dibuat_pada,h.ranking,`"${h.alternatif_nama}"`,h.skor.toFixed(6)])));
      dlFile(rows.map(r=>r.join(",")).join("\n"),"AdobsBI_All.csv","text/csv");
    }else if(fmt==="xlsx"){
      const combined={nama:"Semua Data",metode:"MIX",hasil:details.flatMap(d=>d.hasil.map(h=>({...h,alternatif_nama:`[${d.nama}] ${h.alternatif_nama}`})))};
      dlFile(toXLSX(combined),"AdobsBI_All.xls","application/vnd.ms-excel");
    }else{
      dlFile(JSON.stringify(details,null,2),"AdobsBI_All.json","application/json");
    }
    toast(`${fmt.toUpperCase()} diunduh ✓`,"success");
  }catch(err){toast("Gagal: "+err.message,"error");}
}
document.getElementById("exp-all-csv").addEventListener("click",()=>expAll("csv"));
document.getElementById("exp-all-xlsx").addEventListener("click",()=>expAll("xlsx"));
document.getElementById("exp-all-json").addEventListener("click",()=>expAll("json"));

document.getElementById("btn-push-pbi").addEventListener("click",async()=>{
  const sm=document.getElementById("pbi-smsg");
  if(!pbiToken){sm.className="smsg error";sm.textContent="Login Microsoft dulu.";return;}
  sm.className="smsg";sm.textContent="Menyiapkan...";
  try{
    const r=await apiFetch(`${API}/api/studi-kasus`),list=await r.json();
    if(!list.length)throw new Error("Belum ada data.");
    const details=await Promise.all(list.map(s=>apiFetch(`${API}/api/studi-kasus/${s.id}`).then(r=>r.json())));
    const rows=details.flatMap(d=>d.hasil.map(h=>({StudiKasusId:d.id,Nama:d.nama,Metode:d.metode,Ranking:h.ranking,Alternatif:h.alternatif_nama,Skor:h.skor})));
    sm.className="smsg success";sm.textContent=`[Simulasi] ${rows.length} baris siap → Power BI. Sambungkan Azure App untuk push nyata.`;
    toast(`${rows.length} baris siap untuk Power BI ✓`,"success");
  }catch(err){sm.className="smsg error";sm.textContent=err.message;}
});

// ===== UNIT TEST =====
document.getElementById("btn-run-test").addEventListener("click",()=>{
  const tests=[
    (()=>{const skor=saw([[8,6],[9,7],[7,8]],[{bobot:.5,tipe:"benefit"},{bobot:.3,tipe:"benefit"}]);return{name:"SAW Edge: Bobot Tidak 100%",pass:skor.every(s=>isFinite(s)&&!isNaN(s)),detail:`Bobot total=0.8 (bukan 1.0). SAW tetap hitung tapi backend tolak dengan HTTP 400. Skor=[${skor.map(s=>s.toFixed(4)).join(", ")}]`};}),
    (()=>{const skor=saw([[5,5],[5,5],[5,5]],[{bobot:.6,tipe:"benefit"},{bobot:.4,tipe:"benefit"}]);return{name:"SAW Edge: Semua Nilai Sama → Semua Skor Sama",pass:skor.every(s=>Math.abs(s-skor[0])<.001),detail:`Semua 5. Skor=[${skor.map(s=>s.toFixed(4)).join(", ")}]. Normalisasi = 1.0 semua → tie.`};}),
    (()=>{const skor=saw([[9,3],[7,6],[5,9]],[{bobot:.5,tipe:"benefit"},{bobot:.5,tipe:"cost"}]);const exp=[1.0,7/9*.5+3/6*.5,5/9*.5+3/9*.5];return{name:"SAW Happy Path: Benefit + Cost Mix",pass:skor.every((s,i)=>Math.abs(s-exp[i])<.001),detail:`Expected≈[${exp.map(e=>e.toFixed(4)).join(", ")}], Got=[${skor.map(s=>s.toFixed(4)).join(", ")}]`};}),
    (()=>{const skor=topsis([[8,7,9]],[{bobot:.4,tipe:"benefit"},{bobot:.3,tipe:"benefit"},{bobot:.3,tipe:"cost"}]);return{name:"TOPSIS Edge: 1 Alternatif → Skor 0",pass:skor.length===1&&!isNaN(skor[0]),detail:`1 alt → D+=D-=0 → skor=0. Got=${skor[0].toFixed(4)}.`};}),
    (()=>{const skor=topsis(DEF_M,DEF_K.map(k=>({bobot:k.bobot,tipe:k.tipe})));const ord=[...Array(skor.length).keys()].sort((a,b)=>skor[b]-skor[a]);return{name:"TOPSIS Happy Path: 5 Anime 4 Kriteria",pass:skor.every(s=>s>=0&&s<=1&&!isNaN(s))&&skor[ord[0]]>skor[ord[ord.length-1]],detail:DEF_A.map((a,i)=>`${a.nama}=${skor[i].toFixed(4)}`).join(", ")+`. #1: ${DEF_A[ord[0]].nama}`};}),
    (()=>{const skor=saw([[0,5],[3,8]],[{bobot:.5,tipe:"cost"},{bobot:.5,tipe:"benefit"}]);return{name:"SAW Edge: Nilai 0 di Kriteria Cost (bagi nol)",pass:skor.every(s=>isFinite(s)&&!isNaN(s)),detail:`Alt[0][cost]=0 → ditangani sbg 0, tidak Infinity. Skor=[${skor.map(s=>s.toFixed(4)).join(", ")}]`};})
  ].map(f=>f());
  const pass=tests.filter(t=>t.pass).length,total=tests.length;
  const w=document.getElementById("test-wrap");
  w.innerHTML=`<div class="t-sum"><div><div class="t-sn" style="color:var(--good)">${pass}</div><div class="t-sl">PASSED</div></div><div><div class="t-sn" style="color:var(--err)">${total-pass}</div><div class="t-sl">FAILED</div></div><div><div class="t-sn">${total}</div><div class="t-sl">TOTAL</div></div></div>`;
  tests.forEach(t=>{const d=document.createElement("div");d.className="t-card";d.innerHTML=`<div class="t-hdr"><span class="t-badge ${t.pass?"pass":"fail"}">${t.pass?"✓ PASS":"✗ FAIL"}</span><span class="t-name">${t.name}</span></div><div class="t-detail">${t.detail}</div>`;w.appendChild(d);});
  toast(`Test: ${pass}/${total} PASSED ${pass===total?"🎉":""}`,(pass===total?"success":"error"));
});

// ===== CURSOR ADO — CSS custom cursor (pakai foto asli, sesuai ekspresi) =====
// Logika sama seperti sebelumnya (state machine idle/hover/click/celebrate,
// offscreen canvas -> data URL -> CSS cursor, hotspot di tengah kepala).
// Bedanya cuma karakternya: sekarang gambar Ado asli, bukan gambar tangan.
//   idle/hover  -> ado_smile.png  (ekspresi senyum)
//   click       -> ado_pout.png   (ekspresi manyun, reaksi lucu waktu diklik)
//   celebrate   -> ado_pixel_cursor.png (jempol pixel, waktu hasil keluar — TETAP
//                  ADA sampai user berinteraksi lagi, tidak hilang otomatis)

const CUR_W=56, CUR_H=56;
const CUR_HD=3; // render kursor 3x lebih tinggi resolusinya (HD/retina), tampil tetap 56x56 di layar
const offC=document.createElement("canvas");
offC.width=CUR_W*CUR_HD; offC.height=CUR_H*CUR_HD;
const offX=offC.getContext("2d");
offX.setTransform(CUR_HD,0,0,CUR_HD,0,0); // semua koordinat gambar tetap ditulis dalam skala 56x56 (logis)

let cState="idle";
function triggerCelebrate(){
  cState="celebrate";drawCursorFrame("celebrate");applyCursorCSS();
}

const oldCurCanvas=document.getElementById("cursor-canvas");
if(oldCurCanvas) oldCurCanvas.style.display="none";

function drawCursorFrame(state){
  offX.clearRect(0,0,CUR_W,CUR_H);
  const cx=CUR_W/2, cy=CUR_H/2+1;

  const aura=offX.createRadialGradient(cx,cy,4,cx,cy,26);
  aura.addColorStop(0,"rgba(108,142,255,0.28)");
  aura.addColorStop(1,"rgba(108,142,255,0)");
  offX.fillStyle=aura;
  offX.beginPath();offX.arc(cx,cy,26,0,Math.PI*2);offX.fill();

  let img=ADO_IMG.curSmile, pad=3, smooth=true;
  if(state==="click"){img=ADO_IMG.curPout;pad=4;}
  else if(state==="celebrate"){img=ADO_IMG.pixelCur;pad=6;smooth=false;}
  drawContain(offX,img,CUR_W,CUR_H,pad,smooth);

  if(state==="celebrate"){
    const colors=["rgba(251,191,36,.95)","rgba(192,132,252,.9)","rgba(108,142,255,.9)"];
    [[cx+22,cy-20],[cx-22,cy-18],[cx+20,cy+18]].forEach(([sx,sy],si)=>{
      offX.save();offX.translate(sx,sy);
      offX.fillStyle=colors[si%colors.length];
      offX.beginPath();
      for(let p=0;p<5;p++){
        offX.lineTo(Math.cos((p*4*Math.PI/5)-Math.PI/2)*4.5,Math.sin((p*4*Math.PI/5)-Math.PI/2)*4.5);
        offX.lineTo(Math.cos((p*4*Math.PI/5+2*Math.PI/5)-Math.PI/2)*2,Math.sin((p*4*Math.PI/5+2*Math.PI/5)-Math.PI/2)*2);
      }
      offX.closePath();offX.fill();offX.restore();
    });
  }
}

function applyCursorCSS(){
  const dataURL=offC.toDataURL();
  const hs=CUR_W/2; // hotspot dalam satuan logis (28,28), sama walau gambar sumbernya HD
  // image-set() bikin browser pakai gambar resolusi tinggi tapi TAMPIL di ukuran 56x56 biasa
  // (retina-crisp). url() polos di akhir cuma fallback browser lama.
  const cur=`-webkit-image-set(url(${dataURL}) ${CUR_HD}x) ${hs} ${hs}, image-set(url(${dataURL}) ${CUR_HD}x) ${hs} ${hs}, url(${dataURL}) ${hs} ${hs}, pointer`;
  document.body.style.setProperty("cursor", cur, "important");
  let sheet=document.getElementById("_cur_style");
  if(!sheet){sheet=document.createElement("style");sheet.id="_cur_style";document.head.appendChild(sheet);}
  sheet.textContent=`*{cursor:${cur} !important}`;
}

// Catatan: klik/hover sesudah "celebrate" akan otomatis ganti ke state click/hover
// seperti biasa (jadi celebrate baru berhenti kalau memang ada interaksi baru,
// bukan hilang sendiri karena timer).
document.addEventListener("mousedown",()=>{cState="click";drawCursorFrame("click");applyCursorCSS();});
document.addEventListener("mouseup",()=>{if(cState==="click"){cState="idle";drawCursorFrame("idle");applyCursorCSS();}});
document.addEventListener("mouseover",e=>{
  const isInteractive=e.target.closest("button,a,input,select,textarea,.nav-item,.btn-ghost,.btn-primary,.btn-remove,.profile-btn");
  if(cState!=="click"){
    const next=isInteractive?"hover":"idle";
    if(next!==cState){cState=next;drawCursorFrame(cState);applyCursorCSS();}
  }
});

// Gambar sekali di awal, lalu ulang begitu tiap foto Ado selesai dimuat browser
drawCursorFrame("idle");applyCursorCSS();
[ADO_IMG.curSmile,ADO_IMG.curPout,ADO_IMG.pixelCur].forEach(img=>{
  img.addEventListener("load",()=>{drawCursorFrame(cState);applyCursorCSS();});
});

// ===== SIDEBAR CHIBI (foto asli Ado, bukan gambar tangan) =====
const sbC=document.getElementById("sb-chibi"),sbX=hiDPICanvas(sbC,90,90);
let sbF=0;
function drawSBChibi(){
  sbX.clearRect(0,0,90,90);
  const bob=Math.sin(sbF*.04)*4,cx=45,cy=45+bob;
  // backdrop solid biar chibi (rambut/baju gelap) nggak nyatu sama sidebar yang gelap
  sbX.beginPath();sbX.arc(cx,cy,38,0,Math.PI*2);
  sbX.fillStyle=isDark?"#1c2a45":"#e8eeff";sbX.fill();
  sbX.strokeStyle=isDark?"#2a3d60":"#b8c4e8";sbX.lineWidth=1.5;sbX.stroke();
  const grad=sbX.createRadialGradient(cx,cy,5,cx,cy,40);
  grad.addColorStop(0,"rgba(108,142,255,.16)");grad.addColorStop(1,"transparent");
  sbX.fillStyle=grad;sbX.beginPath();sbX.ellipse(cx,cy,40,40,0,0,Math.PI*2);sbX.fill();
  sbX.save();sbX.translate(0,bob);
  drawContain(sbX,isDark?ADO_IMG.bustDark:ADO_IMG.bust,90,90,6);
  sbX.restore();
  sbF++;requestAnimationFrame(drawSBChibi);
}
drawSBChibi();

// ===== HERO CHIBI (foto Ado meluk logo Ado's BI) =====
const hC=document.getElementById("hero-chibi"),hX=hiDPICanvas(hC,170,170);
let hF=0;
function drawHeroChibi(){
  hX.clearRect(0,0,170,170);
  const bob=Math.sin(hF*.03)*6,cx=85,cy=85+bob;
  hX.save();hX.translate(0,bob);
  drawContain(hX,ADO_IMG.hero,170,170,2);
  hX.restore();
  [[cx-38,cy-42,0],[cx+34,cy-50,.7],[cx+42,cy+2,1.4],[cx-32,cy+14,2.1]].forEach(([sx,sy,ph])=>{
    const al=(Math.sin(hF*.05+ph)*.5+.5)*.8;
    hX.fillStyle=`rgba(192,132,252,${al.toFixed(2)})`;hX.beginPath();hX.arc(sx,sy,2.5,0,Math.PI*2);hX.fill();
  });
  hF++;requestAnimationFrame(drawHeroChibi);
}
drawHeroChibi();

// ===== LOGO SIDEBAR (pakai logo asli "ado'sbi", wordmark sudah menyatu di gambar) =====
const LOGO_W=176, LOGO_H=60;
const lgC=document.getElementById("logo-chibi");
const lgX=hiDPICanvas(lgC,LOGO_W,LOGO_H);
let lgF=0;
function drawLogoChibi(){
  lgX.clearRect(0,0,LOGO_W,LOGO_H);
  drawContain(lgX,ADO_IMG.logoMark,LOGO_W,LOGO_H,4); // pad kecil biar logo lebih rapat, ga ada jarak kosong berlebih
  lgF++;requestAnimationFrame(drawLogoChibi);
}
drawLogoChibi();

// ===== GAME (karakter pixel Ado, lebih banyak tantangan) =====
// Perubahan dari versi lama:
//  - Karakter = ado_pixel_game.png (bukan gambar tangan lagi), digambar blocky/nearest.
//  - Bukan cuma lompat: ada juga batu MELAYANG yang harus DITUNDUKKAN (tekan ↓ / S).
//  - Rintangan digambar sebagai batu bergaya pixel (blok-blok kotak), bukan emoji.
//  - Kecepatan dibatasi (capped) supaya gamenya nggak jadi kelewat ngebut.
const gc=document.getElementById("game-canvas"),gx=gc.getContext("2d");
const GND=54,JV=-12,GRAV=.58,CHX=44;
const DUCK_H=12,STAND_H=20; // tinggi hitbox karakter berdiri vs nunduk
const SPD_BASE=3, SPD_MAX=7.2; // <-- batas atas kecepatan, biar ga "kecepetan banget"
let gF=0,gSc=0,chY=GND,chVY=0,jumping=false,ducking=false,obstacles=[],obT=0,obI=115,dead=false,gSpd=SPD_BASE,started=false;

function spawnOb(){
  // Setelah skor > 120, mulai muncul juga rintangan MELAYANG (harus nunduk).
  const canFly = gSc>120 && Math.random()<0.38;
  if(canFly){
    obstacles.push({x:gc.width+10,w:22,h:14,y:GND-34,type:"fly"});
  } else if(Math.random()<0.3){
    // gerombolan 2 batu kecil berdempetan (variasi ritme lompat)
    const h=10+Math.random()*10;
    obstacles.push({x:gc.width+10,w:9,h,y:GND-h,type:"rock"});
    obstacles.push({x:gc.width+24,w:9,h:h+4,y:GND-(h+4),type:"rock"});
  } else {
    const h=12+Math.random()*22;
    obstacles.push({x:gc.width+10,w:13,h,y:GND-h,type:"rock"});
  }
}
function resetGame(){
  gF=0;gSc=0;chY=GND;chVY=0;jumping=false;ducking=false;obstacles=[];obT=0;obI=115;dead=false;gSpd=SPD_BASE;started=true;
  document.getElementById("gs-val").textContent="0";
}
function gameJump(){if(!jumping&&!ducking){chVY=JV;jumping=true;}}
gc.addEventListener("click",()=>{
  if(!started){started=true;return;} // klik pertama cuma mulai gamenya, ga langsung lompat
  dead?resetGame():gameJump();
});
document.addEventListener("keydown",e=>{
  // JANGAN nyolong tombol Space/Panah kalau usernya lagi ngetik di form/input manapun
  const tag=(e.target&&e.target.tagName||"").toLowerCase();
  const isTyping = tag==="input"||tag==="textarea"||tag==="select"||(e.target&&e.target.isContentEditable);
  if(isTyping)return;
  if(e.code==="Space"){
    e.preventDefault();
    if(!started){started=true;return;} // space pertama cuma mulai gamenya
    dead?resetGame():gameJump();
  }
  else if((e.code==="ArrowDown"||e.code==="KeyS")&&!jumping&&!dead){ducking=true;}
});
document.addEventListener("keyup",e=>{
  if(e.code==="ArrowDown"||e.code==="KeyS"){ducking=false;}
});

// Batu bergaya pixel: blok-blok kotak kecil, bukan bentuk halus
function drawPixelRock(x,y,w,h,tone){
  const cell=Math.max(3,Math.round(Math.min(w,h)/4));
  const cols=Math.max(2,Math.round(w/cell)), rows=Math.max(2,Math.round(h/cell));
  const base = tone==="fly" ? ["#8b5cf6","#6d28d9","#c4b5fd"] : ["#94a3b8","#475569","#e2e8f0"];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      // bentuk agak "acak tapi konsisten" pakai hash sederhana biar tiap batu unik & blocky
      const seed=(r*31+c*17+Math.floor(x/7))%5;
      if(seed===0 && (r===0||c===0||c===cols-1)) continue; // gerigi di pinggir
      const shade = (r+c)%3===0?base[2]:((r+c)%3===1?base[0]:base[1]);
      gx.fillStyle=shade;
      gx.fillRect(x+c*cell, y+r*cell, cell-0.5, cell-0.5);
    }
  }
}

function drawGameChar(x,y){
  const img=ADO_IMG.pixelGame;
  if(!img.complete||!img.naturalWidth){
    gx.fillStyle="#2d5fd6";gx.fillRect(x-7,y-24,14,24);return;
  }
  gx.imageSmoothingEnabled=false;
  const h = ducking?24:36;
  const w = img.naturalWidth*(h/img.naturalHeight);
  const bob = (!jumping&&!ducking) ? (Math.floor(gF/8)%2===0?0:1.5) : 0;
  gx.drawImage(img, x-w/2, y-h+bob, w, h);
}

function gameLoop(){
  const W=gc.width;
  gx.clearRect(0,0,W,gc.height);
  gx.fillStyle=isDark?"#070b14":"#f0f4ff";gx.fillRect(0,0,W,gc.height);
  gx.strokeStyle=isDark?"rgba(108,142,255,.25)":"rgba(74,108,240,.2)";gx.lineWidth=1.5;
  gx.beginPath();gx.moveTo(0,GND+4);gx.lineTo(W,GND+4);gx.stroke();
  gx.fillStyle=isDark?"rgba(255,255,255,.3)":"rgba(100,120,200,.2)";
  for(let s=0;s<6;s++){const sx=(s*157+gF*.25)%W;gx.beginPath();gx.arc(sx,6+s*8,1,0,Math.PI*2);gx.fill();}
  if(started&&!dead){
    gF++;
    // kecepatan naik pelan2 sesuai skor tapi DIBATASI di SPD_MAX
    gSpd=Math.min(SPD_BASE+Math.floor(gSc/220)*.5, SPD_MAX);
    gSc+=Math.round(gSpd/3);
    document.getElementById("gs-val").textContent=gSc;
    chVY+=GRAV;chY+=chVY;if(chY>=GND){chY=GND;chVY=0;jumping=false;}
    obT++;if(obT>=obI){spawnOb();obT=0;obI=70+Math.random()*85;}
    obstacles.forEach(o=>o.x-=gSpd);obstacles=obstacles.filter(o=>o.x>-30);
    const hitH = ducking?DUCK_H:STAND_H;
    obstacles.forEach(o=>{
      if(CHX+8>o.x&&CHX-8<o.x+o.w&&chY-2>o.y&&chY-hitH<o.y+o.h)dead=true;
    });
  }
  obstacles.forEach(o=>drawPixelRock(o.x,o.y,o.w,o.h,o.type));
  drawGameChar(CHX,chY);
  if(!started){
    gx.fillStyle="rgba(0,0,0,.5)";gx.fillRect(W/2-100,16,200,44);
    gx.fillStyle="#e2e8f0";gx.font="bold 13px Inter,sans-serif";gx.textAlign="center";gx.fillText("Klik / SPACE buat mulai~",W/2,36);
    gx.fillStyle="#94a3b8";gx.font="9.5px Inter,sans-serif";gx.fillText("↓ / S = nunduk pas udah jalan",W/2,49);
  } else if(dead){
    gx.fillStyle="rgba(0,0,0,.55)";gx.fillRect(W/2-95,16,190,44);
    gx.fillStyle="#f87171";gx.font="bold 13px Inter,sans-serif";gx.textAlign="center";gx.fillText(`Game Over! Score: ${gSc}`,W/2,36);
    gx.fillStyle="#94a3b8";gx.font="9.5px Inter,sans-serif";gx.fillText("Klik / SPACE main lagi  •  ↓ / S = nunduk",W/2,49);
  }
  requestAnimationFrame(gameLoop);
}
gameLoop();

// ===== ONBOARDING TOUR =====
const STEPS=[
  {sel:".hero-banner",text:"Halo! Aku Ado~ Selamat datang di Ado's BI! Ini adalah sistem pendukung keputusan yang bisa bantu kamu ranking apapun secara ilmiah! 🎤"},
  {sel:"[data-tour='step1']",text:"Pertama, isi nama studi kasus dan pilih metode — SAW atau TOPSIS. Keduanya keren kok!"},
  {sel:"[data-tour='step2']",text:"Lalu tambahkan kriteria penilaian. Pastikan total bobotnya = 1.00 ya~ Lihat progress bar-nya!"},
  {sel:"#btn-hitung",text:"Terakhir, klik tombol ini untuk menghitung! Aku akan langsung kasih tau siapa yang ranking 1~ ⚡"},
  {sel:"#game-canvas",text:"Oh iya, ada mini game di bawah! Tekan SPACE atau klik untuk lompati rintangan. Jangan biarkan Ado nabrak! 😄"},
  {sel:".profile-btn",text:"Klik di sini untuk login dengan Google atau Microsoft. Kalau login Microsoft, bisa push data langsung ke Power BI lho! Gambatte! 🎌"}
];
let tourStep=0,tourActive=false;
function startTour(){
  tourStep=0;tourActive=true;
  document.getElementById("onboarding-overlay").style.display="block";
  showTourStep();
}
function positionSpotlight(el){
  if(!el){document.getElementById("onboard-spotlight").style.cssText="opacity:0";return;}
  const r=el.getBoundingClientRect();
  const sp=document.getElementById("onboard-spotlight");
  sp.style.cssText=`top:${r.top-8}px;left:${r.left-8}px;width:${r.width+16}px;height:${r.height+16}px;opacity:1`;
}
function showTourStep(){
  if(tourStep>=STEPS.length){endTour();return;}
  const step=STEPS[tourStep];
  const el=document.querySelector(step.sel);
  // Update text & dots
  document.getElementById("onboard-text").textContent=step.text;
  const ind=document.getElementById("onboard-step-ind");
  ind.innerHTML=STEPS.map((_,i)=>`<div class="osi${i===tourStep?" active":""}"></div>`).join("");
  drawOnboardChibi(tourStep%3);
  if(!el){positionSpotlight(null);return;}
  // Scroll element into view first, then reposition spotlight after animation
  el.scrollIntoView({behavior:"smooth",block:"center"});
  // Wait for scroll to settle (~600ms) then update spotlight position
  setTimeout(()=>positionSpotlight(document.querySelector(step.sel)),650);
}
function endTour(){tourActive=false;document.getElementById("onboarding-overlay").style.display="none";localStorage.setItem("ado-toured","1");}
document.getElementById("onboard-next").addEventListener("click",()=>{tourStep++;showTourStep();});
document.getElementById("onboard-skip").addEventListener("click",endTour);
document.getElementById("btn-tour").addEventListener("click",startTour);

// Onboard chibi
const obC=document.getElementById("onboard-chibi"),obX=hiDPICanvas(obC,100,110);
let obF=0;
function drawOnboardChibi(){
  obX.clearRect(0,0,100,110);
  const bob=Math.sin(obF*.05)*4;
  obX.save();obX.translate(0,bob);
  drawContain(obX,ADO_IMG.onboard,100,110,3);
  obX.restore();
  obF++;requestAnimationFrame(drawOnboardChibi);
}
drawOnboardChibi();

// Show tour on first visit
if(!localStorage.getItem("ado-toured"))setTimeout(startTour,1200);

// ===== INIT =====
function loadDefault(){
  kriteriaList=DEF_K.map(k=>({...k}));
  alternatifList=DEF_A.map(a=>({...a}));
  DEF_M.forEach((row,ai)=>row.forEach((v,ki)=>{matriksNilai[`${ai}-${ki}`]=v;}));
  document.getElementById("input-nama").value="Ranking Anime Terbaik 2025";
  document.getElementById("input-metode").value="TOPSIS";
  renderKriteria();renderAlt();
}
loadDefault();
document.getElementById("api-url").textContent=location.origin+"/api/studi-kasus";
