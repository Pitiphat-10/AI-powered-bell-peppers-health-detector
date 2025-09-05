// ===== Config & state =====
const modelURL = "model/model.json";
const metadataURL = "model/metadata.json";
let model, metadata;
let results = []; // {name, topLabel, topScore, all: [..]}

// ===== Elements =====
const uploadEl   = document.getElementById("upload");
const addBtn     = document.getElementById("addBtn");
const clearBtn   = document.getElementById("clearBtn");
const exportBtn  = document.getElementById("exportBtn");
const dropZone   = document.getElementById("dropZone");
const gallery    = document.getElementById("gallery");
const statusEl   = document.getElementById("status");
const progressWrap = document.getElementById("progressWrap");
const barEl        = document.getElementById("bar");
const progressText = document.getElementById("progressText");

// Camera elements
const cameraBtn = document.getElementById("cameraBtn");
const camModal  = document.getElementById("camModal");
const camClose  = document.getElementById("camClose");
const camCapture= document.getElementById("camCapture");
const camSwitch = document.getElementById("camSwitch");
const video     = document.getElementById("video");
const canvas    = document.getElementById("canvas");

let stream = null;
let useBackCamera = true; // เริ่มด้วยกล้องหลังถ้ามี

// ===== Model loader =====
async function loadModel() {
  try {
    statusEl.textContent = "กำลังโหลดโมเดล…";
    model = await tf.loadLayersModel(modelURL);
    const metaRes = await fetch(metadataURL);
    metadata = await metaRes.json();
    statusEl.textContent = "พร้อมใช้งาน";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "โหลดโมเดลไม่สำเร็จ";
  }
}
loadModel();

// ===== Helpers =====
function setProgress(done, total) {
  progressWrap.classList.remove("hidden");
  const pct = total ? Math.round((done / total) * 100) : 0;
  barEl.style.width = `${pct}%`;
  progressText.textContent = `กำลังวิเคราะห์… (${done}/${total})`;
  if (done === total) {
    setTimeout(() => progressWrap.classList.add("hidden"), 500);
  }
}

function createCard(src, name, rowsHtml) {
  const el = document.createElement("div");
  el.className = "rounded-xl border border-brand-600/20 overflow-hidden bg-white/70 dark:bg-brand-900/50";
  el.innerHTML = `
    <div class="aspect-square bg-brand-100/40 dark:bg-brand-800/40 flex items-center justify-center">
      <img src="${src}" alt="${name}" class="max-h-full max-w-full object-contain"/>
    </div>
    <div class="p-3">
      <p class="text-sm font-medium truncate" title="${name}">${name}</p>
      <div class="mt-2 rounded-lg border border-brand-600/15 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-brand-100/40 dark:bg-brand-800/40">
            <tr><th class="text-left px-2 py-1 w-6"></th><th class="text-left px-2 py-1">Prediction</th><th class="text-left px-2 py-1">Confidence</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;
  return el;
}

async function predictImageSource(src, name = "camera.jpg") {
  const img = new Image();
  img.src = src;
  await new Promise((r) => (img.onload = r));

  const probs = await tf.tidy(async () => {
    const input = tf.browser.fromPixels(img)
      .resizeNearestNeighbor([224, 224])
      .toFloat()
      .div(255)
      .expandDims();
    const p = model.predict(input);
    const data = await p.data();
    return Array.from(data);
  });

  const labeled = probs.map((v, i) => ({
    label: (metadata?.labels && metadata.labels[i]) ?? `Class ${i}`,
    score: v
  })).sort((a,b)=>b.score-a.score);

  const top = labeled[0];
  const rows = labeled.slice(0,3).map((r,idx)=>`
    <tr>
      <td class="px-2 py-1">${idx===0?"✅":""}</td>
      <td class="px-2 py-1">${r.label}</td>
      <td class="px-2 py-1">${(r.score*100).toFixed(2)}%</td>
    </tr>`).join("");

  gallery.appendChild(createCard(src, name, rows));

  results.push({
    name,
    topLabel: top.label,
    topScore: +(top.score*100).toFixed(2),
    all: labeled.map(x=>({label:x.label, score:+(x.score*100).toFixed(2)}))
  });
}

async function predictImageFile(file) {
  const url = URL.createObjectURL(file);
  await predictImageSource(url, file.name);
}

async function handleFiles(fileList) {
  if (!model) return;
  const files = Array.from(fileList).filter(f => f.type.startsWith("image/"));
  if (files.length === 0) return;
  let done = 0;
  for (const f of files) {
    await predictImageFile(f);
    done += 1;
    setProgress(done, files.length);
  }
}

// ===== File & DnD events =====
addBtn.addEventListener("click", () => uploadEl.click());
uploadEl.addEventListener("change", (e) => handleFiles(e.target.files));

["dragenter","dragover"].forEach(ev =>
  dropZone.addEventListener(ev, (e)=>{ e.preventDefault(); dropZone.classList.add("ring-2","ring-brand-500"); })
);
["dragleave","drop"].forEach(ev =>
  dropZone.addEventListener(ev, (e)=>{ e.preventDefault(); dropZone.classList.remove("ring-2","ring-brand-500"); })
);
dropZone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

// ===== Camera logic =====
async function startCamera() {
  stopCamera();
  const constraints = {
    video: { facingMode: useBackCamera ? { ideal: "environment" } : "user" },
    audio: false
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
  } catch (err) {
    alert("ไม่สามารถเปิดกล้องได้: " + err.message);
  }
}
function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}
function openModal() {
  camModal.classList.remove("hidden");
  camModal.classList.add("flex");
  startCamera();
}
function closeModal() {
  camModal.classList.add("hidden");
  camModal.classList.remove("flex");
  stopCamera();
}

cameraBtn.addEventListener("click", openModal);
camClose.addEventListener("click", closeModal);
camSwitch.addEventListener("click", async () => {
  useBackCamera = !useBackCamera; 
  await startCamera();
});

camCapture.addEventListener("click", async () => {
  if (!video.videoWidth) return;
  // วาดเฟรมลง canvas แล้วทำนาย
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  await predictImageSource(dataUrl, `camera-${Date.now()}.jpg`);
});

// ===== Utilities =====
clearBtn.addEventListener("click", () => {
  results = [];
  gallery.innerHTML = "";
  uploadEl.value = "";
  setProgress(0,0);
  progressWrap.classList.add("hidden");
});

exportBtn.addEventListener("click", () => {
  if (results.length === 0) return;
  const header = ["filename","top_label","top_confidence(%)","top3"].join(",");
  const rows = results.map(r => {
    const top3 = r.all.slice(0,3).map(x=>`${x.label}:${x.score}%`).join("|");
    return [escapeCsv(r.name), escapeCsv(r.topLabel), r.topScore, escapeCsv(top3)].join(",");
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "predictions.csv"; a.click();
  URL.revokeObjectURL(url);
});

function escapeCsv(s){ return `"${String(s).replace(/"/g,'""')}"`; }

// ปิดสตรีมเมื่อปิดแท็บ/เปลี่ยนหน้า
window.addEventListener("beforeunload", stopCamera);

