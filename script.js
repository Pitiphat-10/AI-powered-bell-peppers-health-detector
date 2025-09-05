let model, metadata;
const modelURL = "model/model.json";
const metadataURL = "model/metadata.json";

const uploadEl = document.getElementById("upload");
const previewEl = document.getElementById("preview");
const resultEl = document.getElementById("result");
const statusEl = document.getElementById("status");
const progressEl = document.getElementById("progress");
const barEl = document.getElementById("bar");
const clearBtn = document.getElementById("clearBtn");
const openCameraBtn = document.getElementById("openCamera");

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

function setProgress(pct) {
  progressEl.classList.remove("hidden");
  barEl.style.width = `${pct}%`;
}

async function predictFile(file) {
  if (!model) return;
  // preview
  const img = new Image();
  img.src = URL.createObjectURL(file);
  previewEl.src = img.src;
  previewEl.classList.remove("hidden");

  await new Promise((res) => (img.onload = res));

  setProgress(20);

  const pred = await tf.tidy(async () => {
    const input = tf.browser.fromPixels(img)
      .resizeNearestNeighbor([224, 224])   // ปรับตามที่เทรน
      .toFloat()
      .div(255)
      .expandDims();                       // [1, 224, 224, 3]
    setProgress(60);
    const p = model.predict(input);
    const data = await p.data();
    return Array.from(data);
  });

  setProgress(100);
  setTimeout(() => progressEl.classList.add("hidden"), 400);

  // Top-k
  const withIdx = pred.map((v, i) => ({ i, v }));
  withIdx.sort((a, b) => b.v - a.v);
  const k = Math.min(3, withIdx.length);
  const rows = [];
  for (let j = 0; j < k; j++) {
    const { i, v } = withIdx[j];
    const label = (metadata?.labels && metadata.labels[i]) ?? `Class ${i}`;
    rows.push(`<tr>
      <td class="px-3 py-2">${j === 0 ? "✅" : ""}</td>
      <td class="px-3 py-2 font-medium">${label}</td>
      <td class="px-3 py-2">${(v * 100).toFixed(2)}%</td>
    </tr>`);
  }

  resultEl.innerHTML = `
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 dark:bg-slate-800/60">
          <tr>
            <th class="text-left px-3 py-2 w-8"> </th>
            <th class="text-left px-3 py-2">Prediction</th>
            <th class="text-left px-3 py-2">Confidence</th>
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;
}

uploadEl.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) predictFile(file);
});

openCameraBtn.addEventListener("click", () => {
  // เปิดไฟล์จากกล้อง (mobile จะเปิด Camera)
  uploadEl.setAttribute("capture", "environment");
  uploadEl.click();
});

clearBtn.addEventListener("click", () => {
  uploadEl.value = "";
  previewEl.src = "";
  previewEl.classList.add("hidden");
  resultEl.innerHTML = "";
  setProgress(0);
  progressEl.classList.add("hidden");
});
