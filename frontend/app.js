/* Ado's BI — app.js (complete rewrite) */
const API = "";

// STATE
let kriteriaList=[], alternatifList=[], matriksNilai={};
let lastHasil=null, lastRiwayat=null, allRiwayat=[];
let currentUser=null, pbiToken=null;
let chartHasil=null, chartRiw=null, chartWI=null;
let wiData=null, isDark=true;

// DEFAULT DATA
const DEF_K=[
  {nama:"Story / Plot",bobot:.30,tipe:"benefit"},
  {nama:"Animation Quality",bobot:.25,tipe:"benefit"},
  {nama:"Soundtrack / OST",bobot:.25,tipe:"benefit"},
  {nama:"Harga Nonton ($/bl)",bobot:.20,tipe:"cost"}
];
const DEF_A=[{nama:"Attack on Titan"},{nama:"Demon Slayer"},{nama:"Jujutsu Kaisen"},{nama:"Spy x Family"},{nama:"Oshi no Ko"}];
const DEF_M=[[9.5,9.0,9.2,15],[9.0,9.8,9.5,13],[8.8,9.5,8.7,13],[8.5,8.8,8.5,10],[9.2,9.0,9.0,12]];

// ===========================
// Microsoft Authentication
// ===========================

const msalConfig = {
    auth: {
        clientId: "a2e965b0-c3ea-4733-b082-c50f2954e4e8",
        authority: "https://login.microsoftonline.com/7e59309b-f5df-4e4b-bc4b-8e2946fdd9ea",
        redirectUri: window.location.origin
    }
};

const loginRequest = {
    scopes: [
        "openid",
        "profile",
        "email",
        "https://analysis.windows.net/powerbi/api/Dataset.ReadWrite.All",
        "https://analysis.windows.net/powerbi/api/Workspace.Read.All",
        "https://analysis.windows.net/powerbi/api/Report.Read.All"
    ]
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// ===== TOAST =====
function toast(msg,type=""){
  const t=document.getElementById("toast");
  t.textContent=msg; t.className="toast "+type+" show";
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),3200);
}

// ===== THEME =====
function applyTheme(dark){
  isDark=dark;
  document.documentElement.setAttribute("data-theme",dark?"dark":"light");
  document.getElementById("theme-icon").textContent=dark?"🌙":"☀️";
  localStorage.setItem("ado-theme",dark?"dark":"light");
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

function drawMiniChibi(ctx,cx,cy,r,mood){
  ctx.fillStyle="#ffe4c4";ctx.beginPath();ctx.arc(cx,cy-r*.1,r*.7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#2d1b69";ctx.beginPath();ctx.ellipse(cx,cy-r*.7,r*.7,r*.35,0,Math.PI,Math.PI*2);ctx.fill();
  ctx.fillStyle="#1a1040";
  ctx.beginPath();ctx.arc(cx-r*.3,cy-r*.15,r*.2,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(cx+r*.3,cy-r*.15,r*.2,0,Math.PI*2);ctx.fill();
  if(mood==="happy"){ctx.strokeStyle="#c0392b";ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(cx,cy+r*.15,r*.25,0.1,Math.PI-.1);ctx.stroke();}
  else if(mood==="star"){ctx.fillStyle="#fbbf24";ctx.beginPath();ctx.arc(cx,cy+r*.15,r*.2,0,Math.PI*2);ctx.fill();}
}

function setLoggedIn(name,email,provider){
    currentUser={name,email,provider};

    document.getElementById("pd-logged-out").style.display="none";
    document.getElementById("pd-logged-in").style.display="block";
    document.getElementById("pd-name").textContent=name;
    document.getElementById("pd-email").textContent=email;

    if(provider==="microsoft"){
        document.getElementById("pbi-login-area").style.display="none";
        document.getElementById("pbi-area").style.display="block";
        document.getElementById("pbi-uname").textContent=name;
        document.getElementById("pbi-dot").className="pdot on";
        document.getElementById("pbi-stxt").textContent="Terhubung ke Power BI";
    }

    const av=document.getElementById("pd-avatar"),
          ax=av.getContext("2d");

    ax.clearRect(0,0,40,40);
    ax.fillStyle=isDark?"#1c2a45":"#e8eeff";
    ax.beginPath();
    ax.arc(20,20,19,0,Math.PI*2);
    ax.fill();

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
  const n=prompt(`Simulasi ${provider} Login\nNama:`),e=prompt("Email:");
  if(n&&e){setLoggedIn(n,e,provider);pdEl.style.display="none";}
}
document.getElementById("pd-google").addEventListener("click",()=>doLogin("Google"));
document.getElementById("pd-ms").addEventListener("click",loginMicrosoft);
document.getElementById("pbi-ms-login").addEventListener("click",loginMicrosoft);
document.getElementById("pd-logout").addEventListener("click",()=>{setLoggedOut();pdEl.style.display="none";});
document.getElementById("pd-history").addEventListener("click",()=>{
  document.querySelector('.nav-item[data-tab="riwayat"]').click();pdEl.style.display="none";
});
document.getElementById("pd-export-btn").addEventListener("click",()=>{
  document.querySelector('.nav-item[data-tab="export"]').click();pdEl.style.display="none";
});
renderProfileCanvas("anon");

async function loginMicrosoft() {
    try {
        const loginResponse = await msalInstance.loginPopup(loginRequest);

        const tokenResponse = await msalInstance.acquireTokenPopup(loginRequest);

        pbiToken = tokenResponse.accessToken;

        setLoggedIn(
            loginResponse.account.name || loginResponse.account.username,
            loginResponse.account.username,
            "microsoft"
        );

        pdEl.style.display = "none";

    } catch (err) {
        console.error(err);
        alert("Login Microsoft gagal.");
    }
}

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
  return new Chart(c,{type:"bar",data:{labels:hasil.map(h=>h.alternatif_nama),datasets:[{label:"Skor",data:hasil.map(h=>h.skor),backgroundColor:colors,borderColor:colors.map(c=>c.replace(/[\d.]+\)$/,"1)")),borderWidth:1.5,borderRadius:5}]},options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>" "+ctx.parsed.y.toFixed(4)}}},scales:{x:{ticks:{color:"#94a3b8",font:{size:10.5}},grid:{color:"rgba(255,255,255,0.04)"}},y:{ticks:{color:"#94a3b8",font:{size:10.5}},grid:{color:"rgba(255,255,255,0.05)"},beginAtZero:true}}}});
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
      const r=await fetch(`${API}/api/studi-kasus`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
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
    const r=await fetch(`${API}/api/studi-kasus`),data=await r.json();
    allRiwayat=data;tb.innerHTML="";
    if(!data.length){tb.innerHTML='<tr><td colspan="4" class="tdc">Belum ada studi kasus.</td></tr>';return;}
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
      const r=await fetch(`${API}/api/studi-kasus/${e.target.dataset.id}`),data=await r.json();
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
function fillWISelect(){
  const s=document.getElementById("wi-sel"),cur=s.value;
  s.innerHTML='<option value="">-- Pilih --</option>';
  allRiwayat.forEach(x=>{const o=document.createElement("option");o.value=x.id;o.textContent=`${x.nama} (${x.metode})`;s.appendChild(o);});
  if(cur)s.value=cur;
}
document.getElementById("wi-sel").addEventListener("change",async function(){
  const id=this.value;if(!id){wiData=null;document.getElementById("wi-sliders").innerHTML="";return;}
  try{const r=await fetch(`${API}/api/studi-kasus/${id}`);wiData=await r.json();buildWISliders();}
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
function updateWIBar(){
  if(!wiData?.kriteria)return;
  const vals=wiData.kriteria.map((_,i)=>{const s=document.getElementById(`ws-${i}`);return s?parseFloat(s.value)||0:0;});
  const total=vals.reduce((s,v)=>s+v,0);
  const f=document.getElementById("wi-bbar"),v=document.getElementById("wi-total");
  if(!f||!v)return;
  f.style.width=Math.min(total*100,100)+"%";v.textContent=total.toFixed(2);
  const g=Math.abs(total-1)<.01,o=total>1.01;
  f.className="bbar-fill"+(g?" good":o?" over":"");v.className="bval"+(g?" good":o?" over":"");
}
document.getElementById("btn-wi").addEventListener("click",async()=>{
  if(!wiData){toast("Pilih studi kasus dulu!","error");return;}
  const krit=wiData.kriteria||[];if(!krit.length){toast("Data kriteria tidak tersedia.","error");return;}
  const baru=krit.map((_,i)=>{const s=document.getElementById(`ws-${i}`);return s?parseFloat(s.value)||0:0;});
  const total=baru.reduce((s,v)=>s+v,0);
  if(Math.abs(total-1)>.01){toast(`Total bobot harus 1.0 (${total.toFixed(2)})`,"error");return;}
  try{
    const r=await fetch(`${API}/api/studi-kasus/${wiData.id}`),full=await r.json();
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
    const r=await fetch(`${API}/api/studi-kasus`),list=await r.json();
    if(!list.length){toast("Belum ada data.","error");return;}
    const details=await Promise.all(list.map(s=>fetch(`${API}/api/studi-kasus/${s.id}`).then(r=>r.json())));
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
    const r=await fetch(`${API}/api/studi-kasus`),list=await r.json();
    if(!list.length)throw new Error("Belum ada data.");
    const details=await Promise.all(list.map(s=>fetch(`${API}/api/studi-kasus/${s.id}`).then(r=>r.json())));
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

// ===== CURSOR CHIBI — CSS custom cursor =====
// Karakter = kursor. Offscreen canvas 52x52. Hotspot = tengah kepala = (26,26).
// Digambar sebagai KEPALA BESAR aja biar jelas di ukuran kursor kecil.

const CUR_W=52, CUR_H=52;
const offC=document.createElement("canvas");
offC.width=CUR_W; offC.height=CUR_H;
const offX=offC.getContext("2d");

let cState="idle", cFrame=0, celebTimer=null;
function triggerCelebrate(){cState="celebrate";clearTimeout(celebTimer);celebTimer=setTimeout(()=>cState="idle",3000);}

// Sembunyikan canvas HTML lama kalau masih ada
const oldCurCanvas=document.getElementById("cursor-canvas");
if(oldCurCanvas) oldCurCanvas.style.display="none";

function drawCursorFrame(state, frame){
  offX.clearRect(0,0,CUR_W,CUR_H);
  const cx=CUR_W/2, cy=CUR_H/2+2;

  // === GLOW aura tipis di belakang ===
  const aura=offX.createRadialGradient(cx,cy,4,cx,cy,23);
  aura.addColorStop(0,"rgba(108,142,255,0.25)");
  aura.addColorStop(1,"rgba(108,142,255,0)");
  offX.fillStyle=aura;
  offX.beginPath();offX.arc(cx,cy,23,0,Math.PI*2);offX.fill();

  // === KEPALA ===
  const skinColor = state==="click"?"#f9a8d4" : state==="celebrate"?"#fde68a" : "#ffe4c4";
  offX.fillStyle=skinColor;
  offX.beginPath();offX.ellipse(cx,cy+1,16,15,0,0,Math.PI*2);offX.fill();

  // === RAMBUT ATAS ===
  offX.fillStyle="#2d1b69";
  offX.beginPath();offX.ellipse(cx,cy-12,16,6,0,Math.PI,Math.PI*2);offX.fill();
  // rambut samping kiri
  offX.beginPath();offX.ellipse(cx-14,cy-7,5,8.5,-0.35,0,Math.PI*2);offX.fill();
  // rambut samping kanan
  offX.beginPath();offX.ellipse(cx+14,cy-7,5,8.5,0.35,0,Math.PI*2);offX.fill();

  // === MATA ===
  if(state==="click"){
    // mata X
    offX.strokeStyle="#2d1b69"; offX.lineWidth=2;
    offX.beginPath();offX.moveTo(cx-9,cy-2);offX.lineTo(cx-4,cy+3);offX.stroke();
    offX.beginPath();offX.moveTo(cx-4,cy-2);offX.lineTo(cx-9,cy+3);offX.stroke();
    offX.beginPath();offX.moveTo(cx+4,cy-2);offX.lineTo(cx+9,cy+3);offX.stroke();
    offX.beginPath();offX.moveTo(cx+9,cy-2);offX.lineTo(cx+4,cy+3);offX.stroke();
  } else if(state==="celebrate"){
    // mata bintang / bulan sabit
    offX.fillStyle="#fbbf24";
    offX.beginPath();offX.arc(cx-6,cy,3.5,0,Math.PI*2);offX.fill();
    offX.beginPath();offX.arc(cx+6,cy,3.5,0,Math.PI*2);offX.fill();
    offX.fillStyle=skinColor;
    offX.beginPath();offX.arc(cx-4.5,cy-1,2.5,0,Math.PI*2);offX.fill();
    offX.beginPath();offX.arc(cx+7.5,cy-1,2.5,0,Math.PI*2);offX.fill();
  } else {
    // mata normal + kedip
    const blink=frame%140<5;
    offX.fillStyle="#2d1b69";
    offX.beginPath();offX.ellipse(cx-6,cy,3,blink?0.5:3.8,0,0,Math.PI*2);offX.fill();
    offX.beginPath();offX.ellipse(cx+6,cy,3,blink?0.5:3.8,0,0,Math.PI*2);offX.fill();
    if(!blink){
      // sorot mata putih kecil
      offX.fillStyle="#ffffff";
      offX.beginPath();offX.arc(cx-4.8,cy-1.2,1.2,0,Math.PI*2);offX.fill();
      offX.beginPath();offX.arc(cx+7.2,cy-1.2,1.2,0,Math.PI*2);offX.fill();
    }
  }

  // === MULUT ===
  offX.strokeStyle="#c0392b"; offX.lineWidth=1.5; offX.lineCap="round";
  offX.beginPath();
  if(state==="hover"||state==="celebrate"){
    // senyum lebar
    offX.arc(cx,cy+6,5,0.2,Math.PI-0.2);
  } else if(state==="click"){
    // mulut O kaget
    offX.ellipse(cx,cy+7,3,3.5,0,0,Math.PI*2);
    offX.fillStyle="rgba(192,57,43,0.5)"; offX.fill();
  } else {
    // garis tipis
    offX.moveTo(cx-4,cy+7); offX.lineTo(cx+4,cy+7);
  }
  offX.stroke();

  // === PIPI BLUSH ===
  if(state==="hover"||state==="celebrate"||state==="click"){
    offX.fillStyle="rgba(255,100,100,0.22)";
    offX.beginPath();offX.ellipse(cx-14,cy+4,4.5,3,0,0,Math.PI*2);offX.fill();
    offX.beginPath();offX.ellipse(cx+14,cy+4,4.5,3,0,0,Math.PI*2);offX.fill();
  }

  // === SPARKLE CELEBRATE ===
  if(state==="celebrate"){
    const colors=["rgba(251,191,36,.95)","rgba(192,132,252,.9)","rgba(108,142,255,.9)"];
    [[cx+20,cy-18,0],[cx-20,cy-16,2.1],[cx+18,cy+16,4.2]].forEach(([sx,sy,ph],si)=>{
      const a=frame*.07+ph;
      offX.save();offX.translate(sx+Math.cos(a)*2,sy+Math.sin(a)*2);
      offX.fillStyle=colors[si%colors.length];
      offX.beginPath();
      for(let p=0;p<5;p++){
        offX.lineTo(Math.cos((p*4*Math.PI/5)-Math.PI/2)*5,Math.sin((p*4*Math.PI/5)-Math.PI/2)*5);
        offX.lineTo(Math.cos((p*4*Math.PI/5+2*Math.PI/5)-Math.PI/2)*2,Math.sin((p*4*Math.PI/5+2*Math.PI/5)-Math.PI/2)*2);
      }
      offX.closePath();offX.fill();offX.restore();
    });
  }
}

// Terapkan cursor ke body + semua elemen agar tidak pernah balik ke default
function applyCursorCSS(){
  const dataURL=offC.toDataURL();
  // hotspot 26,26 = tengah kepala = titik klik
  const cur=`url(${dataURL}) 26 26, pointer`;
  document.body.style.setProperty("cursor", cur, "important");
  // Inject/update style tag global — override semua cursor:pointer di CSS
  let sheet=document.getElementById("_cur_style");
  if(!sheet){sheet=document.createElement("style");sheet.id="_cur_style";document.head.appendChild(sheet);}
  sheet.textContent=`*{cursor:url(${dataURL}) 26 26, pointer !important}`;
}

// Update state dari interaksi — TIDAK mengubah cursor, loop yang handle
document.addEventListener("mousedown",()=>{if(cState!=="celebrate"){cState="click";drawCursorFrame("click",cFrame);applyCursorCSS();}});
document.addEventListener("mouseup",()=>{if(cState==="click"){cState="idle";drawCursorFrame("idle",cFrame);applyCursorCSS();}});
document.addEventListener("mouseover",e=>{
  const isInteractive=e.target.closest("button,a,input,select,textarea,.nav-item,.btn-ghost,.btn-primary,.btn-remove,.profile-btn");
  if(cState!=="click"&&cState!=="celebrate"){
    const next=isInteractive?"hover":"idle";
    if(next!==cState){cState=next;drawCursorFrame(cState,cFrame);applyCursorCSS();}
  }
});

// Loop animasi: update tiap beberapa frame untuk blink & kaki jalan
let lastBlink=-1;
function cursorLoop(){
  cFrame++;
  const blinkPhase=Math.floor(cFrame/6);
  if(blinkPhase!==lastBlink&&(cState==="idle"||cState==="hover")){
    drawCursorFrame(cState,cFrame);
    applyCursorCSS();
    lastBlink=blinkPhase;
  }
  requestAnimationFrame(cursorLoop);
}
// Apply sekali di awal sebelum user gerak
drawCursorFrame("idle",0);
applyCursorCSS();
cursorLoop();

// ===== SIDEBAR CHIBI =====
const sbC=document.getElementById("sb-chibi"),sbX=sbC.getContext("2d");
let sbF=0;
function drawSBChibi(){
  sbX.clearRect(0,0,90,90);
  const bob=Math.sin(sbF*.04)*4,cx=45,cy=52+bob;
  const grad=sbX.createRadialGradient(cx,cy,5,cx,cy,35);
  grad.addColorStop(0,"rgba(108,142,255,.1)");grad.addColorStop(1,"transparent");
  sbX.fillStyle=grad;sbX.beginPath();sbX.ellipse(cx,cy,35,35,0,0,Math.PI*2);sbX.fill();
  sbX.fillStyle="#1e3a5f";sbX.beginPath();sbX.ellipse(cx,cy+16,12,14,0,0,Math.PI*2);sbX.fill();
  sbX.fillStyle="#ffe4c4";sbX.beginPath();sbX.ellipse(cx,cy,15,14,0,0,Math.PI*2);sbX.fill();
  sbX.fillStyle="#2d1b69";sbX.beginPath();sbX.ellipse(cx,cy-13,15,5.5,0,Math.PI,Math.PI*2);sbX.fill();
  sbX.beginPath();sbX.ellipse(cx-14,cy-8,4.5,8,-.35,0,Math.PI*2);sbX.fill();
  sbX.beginPath();sbX.ellipse(cx+14,cy-8,4.5,8,.35,0,Math.PI*2);sbX.fill();
  sbX.fillStyle="#2d1b69";
  sbX.beginPath();sbX.ellipse(cx-6,cy-1,3,3.5,0,0,Math.PI*2);sbX.fill();
  sbX.beginPath();sbX.ellipse(cx+6,cy-1,3,3.5,0,0,Math.PI*2);sbX.fill();
  sbX.fillStyle="#fff";sbX.beginPath();sbX.arc(cx-5,cy-2,1.2,0,Math.PI*2);sbX.fill();
  sbX.beginPath();sbX.arc(cx+7,cy-2,1.2,0,Math.PI*2);sbX.fill();
  sbX.strokeStyle="#c0392b";sbX.lineWidth=1.3;sbX.beginPath();sbX.arc(cx,cy+4,4,.1,Math.PI-.1);sbX.stroke();
  if(sbF%80<12){sbX.fillStyle="rgba(251,191,36,.9)";sbX.beginPath();sbX.arc(cx+22,cy-24,3,0,Math.PI*2);sbX.fill();}
  sbF++;requestAnimationFrame(drawSBChibi);
}
drawSBChibi();

// ===== HERO CHIBI =====
const hC=document.getElementById("hero-chibi"),hX=hC.getContext("2d");
let hF=0;
function drawHeroChibi(){
  hX.clearRect(0,0,170,170);
  const bob=Math.sin(hF*.03)*6,cx=85,cy=95+bob;
  const gr=hX.createRadialGradient(cx,cy,10,cx,cy,65);
  gr.addColorStop(0,"rgba(108,142,255,.15)");gr.addColorStop(1,"transparent");
  hX.fillStyle=gr;hX.beginPath();hX.ellipse(cx,cy,65,65,0,0,Math.PI*2);hX.fill();
  hX.fillStyle="#1e3a5f";hX.beginPath();hX.ellipse(cx,cy+20,17,19,0,0,Math.PI*2);hX.fill();
  const arm=Math.sin(hF*.06)*.5;
  hX.strokeStyle="#1e3a5f";hX.lineWidth=8;hX.lineCap="round";
  hX.beginPath();hX.moveTo(cx-17,cy+9);hX.lineTo(cx-30,cy-2+Math.sin(arm)*10);hX.stroke();
  hX.beginPath();hX.moveTo(cx+17,cy+9);hX.lineTo(cx+30,cy-2+Math.sin(-arm)*10);hX.stroke();
  hX.fillStyle="#ffe4c4";hX.beginPath();hX.ellipse(cx,cy-4,21,20,0,0,Math.PI*2);hX.fill();
  hX.fillStyle="#2d1b69";hX.beginPath();hX.ellipse(cx,cy-21,21,7,0,Math.PI,Math.PI*2);hX.fill();
  hX.beginPath();hX.ellipse(cx-19,cy-13,5.5,11,-.3,0,Math.PI*2);hX.fill();
  hX.beginPath();hX.ellipse(cx+19,cy-13,5.5,11,.3,0,Math.PI*2);hX.fill();
  hX.fillStyle="#2d1b69";hX.beginPath();hX.ellipse(cx-7,cy-4,4,5,0,0,Math.PI*2);hX.fill();
  hX.beginPath();hX.ellipse(cx+7,cy-4,4,5,0,0,Math.PI*2);hX.fill();
  hX.fillStyle="#fff";hX.beginPath();hX.ellipse(cx-5.5,cy-5.5,1.5,1.5,0,0,Math.PI*2);hX.fill();
  hX.beginPath();hX.ellipse(cx+8.5,cy-5.5,1.5,1.5,0,0,Math.PI*2);hX.fill();
  hX.strokeStyle="#c0392b";hX.lineWidth=1.5;hX.beginPath();hX.arc(cx,cy+3,5,.15,Math.PI-.15);hX.stroke();
  hX.fillStyle="rgba(255,100,100,.2)";hX.beginPath();hX.ellipse(cx-15,cy+2,5.5,3,0,0,Math.PI*2);hX.fill();
  hX.beginPath();hX.ellipse(cx+15,cy+2,5.5,3,0,0,Math.PI*2);hX.fill();
  [[cx-28,cy-32,0],[cx+24,cy-40,.7],[cx+32,cy+2,1.4],[cx-22,cy+14,2.1]].forEach(([sx,sy,ph])=>{
    const al=(Math.sin(hF*.05+ph)*.5+.5)*.8;
    hX.fillStyle=`rgba(192,132,252,${al.toFixed(2)})`;hX.beginPath();hX.arc(sx,sy,2.5,0,Math.PI*2);hX.fill();
  });
  hF++;requestAnimationFrame(drawHeroChibi);
}
drawHeroChibi();

// ===== LOGO CHIBI =====
const lgC=document.getElementById("logo-chibi"),lgX=lgC.getContext("2d");
let lgF=0;
function drawLogoChibi(){
  lgX.clearRect(0,0,36,36);
  const cx=18,cy=20;
  lgX.fillStyle="#ffe4c4";lgX.beginPath();lgX.ellipse(cx,cy-1,9,8,0,0,Math.PI*2);lgX.fill();
  lgX.fillStyle="#2d1b69";lgX.beginPath();lgX.ellipse(cx,cy-9,9,3.5,0,Math.PI,Math.PI*2);lgX.fill();
  lgX.fillStyle="#2d1b69";
  lgX.beginPath();lgX.arc(cx-4,cy-1,2,0,Math.PI*2);lgX.fill();
  lgX.beginPath();lgX.arc(cx+4,cy-1,2,0,Math.PI*2);lgX.fill();
  const blink=lgF%100<4;
  if(blink){lgX.fillStyle="#ffe4c4";lgX.fillRect(cx-6,cy-3,5,2);lgX.fillRect(cx+1,cy-3,5,2);}
  lgX.strokeStyle="#c0392b";lgX.lineWidth=1;lgX.beginPath();lgX.arc(cx,cy+3,2.5,.2,Math.PI-.2);lgX.stroke();
  if(lgF%60<8){lgX.fillStyle="rgba(108,142,255,.9)";lgX.beginPath();lgX.arc(cx+16,cy-14,2,0,Math.PI*2);lgX.fill();}
  lgF++;requestAnimationFrame(drawLogoChibi);
}
drawLogoChibi();

// ===== GAME (running character) =====
const gc=document.getElementById("game-canvas"),gx=gc.getContext("2d");
const GND=54,JV=-12,GRAV=.58,CHX=44;
let gF=0,gSc=0,chY=GND,chVY=0,jumping=false,obstacles=[],obT=0,obI=120,dead=false,gSpd=3;
function spawnOb(){const h=10+Math.random()*20;obstacles.push({x:gc.width+10,w:10,h,y:GND-h});}
function resetGame(){gF=0;gSc=0;chY=GND;chVY=0;jumping=false;obstacles=[];obT=0;obI=120;dead=false;gSpd=3;document.getElementById("gs-val").textContent="0";}
function gameJump(){if(!jumping){chVY=JV;jumping=true;}}
gc.addEventListener("click",()=>dead?resetGame():gameJump());
document.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();dead?resetGame():gameJump();}});
function drawGameChar(x,y,f){
  const r=Math.floor(f/8)%2;
  gx.fillStyle="#2d1b69";gx.fillRect(x-6,y-20,12,13);
  gx.fillStyle="#ffe4c4";gx.beginPath();gx.ellipse(x,y-26,8,8,0,0,Math.PI*2);gx.fill();
  gx.fillStyle="#1e1040";gx.beginPath();gx.ellipse(x,y-32,8,4,0,Math.PI,Math.PI*2);gx.fill();
  gx.fillStyle="#2d1b69";
  if(jumping){gx.fillRect(x-6,y-8,5,10);gx.fillRect(x+1,y-8,5,10);}
  else if(r===0){gx.fillRect(x-6,y-8,5,12);gx.fillRect(x+1,y-8,5,7);}
  else{gx.fillRect(x-6,y-8,5,7);gx.fillRect(x+1,y-8,5,12);}
  gx.fillStyle="#2d1b69";gx.beginPath();gx.arc(x-3,y-27,2.5,0,Math.PI*2);gx.fill();gx.beginPath();gx.arc(x+3,y-27,2.5,0,Math.PI*2);gx.fill();
}
function gameLoop(){
  const W=gc.width;
  gx.clearRect(0,0,W,gc.height);
  gx.fillStyle=isDark?"#070b14":"#f0f4ff";gx.fillRect(0,0,W,gc.height);
  gx.strokeStyle=isDark?"rgba(108,142,255,.25)":"rgba(74,108,240,.2)";gx.lineWidth=1.5;
  gx.beginPath();gx.moveTo(0,GND+4);gx.lineTo(W,GND+4);gx.stroke();
  // stars/dots
  gx.fillStyle=isDark?"rgba(255,255,255,.3)":"rgba(100,120,200,.2)";
  for(let s=0;s<6;s++){const sx=(s*157+gF*.25)%W;gx.beginPath();gx.arc(sx,6+s*8,1,0,Math.PI*2);gx.fill();}
  if(!dead){
    gF++;gSpd=3+Math.floor(gSc/200)*.4;gSc+=Math.round(gSpd/3);
    document.getElementById("gs-val").textContent=gSc;
    chVY+=GRAV;chY+=chVY;if(chY>=GND){chY=GND;chVY=0;jumping=false;}
    obT++;if(obT>=obI){spawnOb();obT=0;obI=75+Math.random()*90;}
    obstacles.forEach(o=>o.x-=gSpd);obstacles=obstacles.filter(o=>o.x>-20);
    obstacles.forEach(o=>{if(CHX+7>o.x&&CHX-7<o.x+o.w&&chY-2>o.y&&chY-20<o.y+o.h)dead=true;});
  }
  obstacles.forEach(o=>{
    gx.fillStyle="#c084fc";gx.fillRect(o.x,o.y,o.w,o.h);
    gx.font="8px sans-serif";gx.textAlign="center";gx.fillText("👿",o.x+o.w/2,o.y+o.h/2+3);
  });
  drawGameChar(CHX,chY,gF);
  if(dead){
    gx.fillStyle="rgba(0,0,0,.55)";gx.fillRect(W/2-90,18,180,38);
    gx.fillStyle="#f87171";gx.font="bold 13px Inter,sans-serif";gx.textAlign="center";gx.fillText(`Game Over! Score: ${gSc}`,W/2,38);
    gx.fillStyle="#94a3b8";gx.font="10px Inter,sans-serif";gx.fillText("Klik / SPACE untuk main lagi",W/2,51);
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
const obC=document.getElementById("onboard-chibi"),obX=obC.getContext("2d");
let obF=0;
function drawOnboardChibi(mood){
  obX.clearRect(0,0,100,110);
  const cx=50,cy=68,bob=Math.sin(obF*.05)*4;
  obX.fillStyle="#1e3a5f";obX.beginPath();obX.ellipse(cx,cy+bob+18,16,18,0,0,Math.PI*2);obX.fill();
  obX.fillStyle="#ffe4c4";obX.beginPath();obX.ellipse(cx,cy+bob-4,21,20,0,0,Math.PI*2);obX.fill();
  obX.fillStyle="#2d1b69";obX.beginPath();obX.ellipse(cx,cy+bob-22,21,7,0,Math.PI,Math.PI*2);obX.fill();
  obX.beginPath();obX.ellipse(cx-19,cy+bob-14,5.5,11,-.3,0,Math.PI*2);obX.fill();
  obX.beginPath();obX.ellipse(cx+19,cy+bob-14,5.5,11,.3,0,Math.PI*2);obX.fill();
  obX.fillStyle="#2d1b69";obX.beginPath();obX.ellipse(cx-7,cy+bob-4,4,5,0,0,Math.PI*2);obX.fill();
  obX.beginPath();obX.ellipse(cx+7,cy+bob-4,4,5,0,0,Math.PI*2);obX.fill();
  obX.fillStyle="#fff";obX.beginPath();obX.arc(cx-5.5,cy+bob-5.5,1.5,0,Math.PI*2);obX.fill();
  obX.beginPath();obX.arc(cx+8.5,cy+bob-5.5,1.5,0,Math.PI*2);obX.fill();
  obX.strokeStyle="#c0392b";obX.lineWidth=1.5;
  if(mood===0){obX.beginPath();obX.arc(cx,cy+bob+3,5,.15,Math.PI-.15);obX.stroke();}
  else if(mood===1){obX.beginPath();obX.arc(cx,cy+bob+2,4,.2,Math.PI-.2);obX.stroke();}
  else{obX.beginPath();obX.moveTo(cx-4,cy+bob+3);obX.lineTo(cx+4,cy+bob+3);obX.stroke();}
  obX.fillStyle="rgba(255,100,100,.2)";
  obX.beginPath();obX.ellipse(cx-15,cy+bob+2,5,3,0,0,Math.PI*2);obX.fill();
  obX.beginPath();obX.ellipse(cx+15,cy+bob+2,5,3,0,0,Math.PI*2);obX.fill();
  // mic
  obX.fillStyle="#6c8eff";obX.beginPath();obX.roundRect(cx-4,cy+bob-40,8,16,4);obX.fill();
  obX.strokeStyle="#6c8eff";obX.lineWidth=2;obX.beginPath();obX.arc(cx,cy+bob-28,10,0,Math.PI);obX.stroke();
  obX.beginPath();obX.moveTo(cx,cy+bob-18);obX.lineTo(cx,cy+bob-14);obX.stroke();
  obF++;requestAnimationFrame(()=>drawOnboardChibi(tourStep%3));
}
drawOnboardChibi(0);

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
