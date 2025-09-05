// ===== Config & state =====
const modelURL = "model/model.json";
const metadataURL = "model/metadata.json";
let model, metadata;
let results = []; // {name, topLabel, topScore, all: [..]}

// ===== Elements =====
const uploadEl = document.getElementById("upload");
const addBtn = document.getElementById("addBtn");
const clearBtn = document.getElementById("clearBtn");
const exportBtn = document.getElementById("exportBtn");
const dropZone = document.getElementById("dropZone");
const gallery = document.getElementById("gallery");
const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("progressWrap");
const barEl = document.getElementById("bar");
const progressText = document.getElementById("progressText");

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

async function predictImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
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

  // render card
  gallery.appendChild(createCard(url, file.name, rows));

  // store result
  results.push({
    name: file.name,
    topLabel: top.label,
    topScore: +(top.score*100).toFixed(2),
    all: labeled.map(x=>({label:x.label, score:+(x.score*100).toFixed(2)}))
  });
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

// ===== Events =====
addBtn.addEventListener("click", () => uploadEl.click());
uploadEl.addEventListener("change", (e) => handleFiles(e.target.files));

["dragenter","dragover"].forEach(ev =>
  dropZone.addEventListener(ev, (e)=>{ e.preventDefault(); dropZone.classList.add("ring-2","ring-brand-500"); })
);
["dragleave","drop"].forEach(ev =>
  dropZone.addEventListener(ev, (e)=>{ e.preventDefault(); dropZone.classList.remove("ring-2","ring-brand-500"); })
);
dropZone.addEventListener("drop", (e) => {
  handleFiles(e.dataTransfer.files);
});

clearBtn.addEventListener("click", () => {
  results = [];
  gallery.innerHTML = "";
  uploadEl.value = "";
  setProgress(0,0);
  progressWrap.classList.add("hidden");
});

// Export CSV (name, top_label, top_confidence, and top3)
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
