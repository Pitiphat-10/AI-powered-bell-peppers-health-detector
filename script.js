/* ========== Bell Pepper Health Detector – Enhanced script.js ========== */

const MODEL_URL = "model/model.json";
const METADATA_URL = "model/metadata.json";

let model, metadata;

/* ---------- 1) Load model once ---------- */
(async () => {
  try {
    setStatus("กำลังโหลดโมเดล…");
    model = await tf.loadLayersModel(MODEL_URL);
    const metaRes = await fetch(METADATA_URL);
    metadata = await metaRes.json();
    setStatus("พร้อมใช้งาน");
  } catch (err) {
    console.error(err);
    setStatus("โหลดโมเดลไม่สำเร็จ");
  }
})();

/* ---------- 2) DOM helpers ---------- */
const uploadInput = document.getElementById("upload");
const cameraInput = document.getElementById("camera");
const resultEl = document.getElementById("result");

function setStatus(text) {
  resultEl.innerHTML = `<div style="opacity:.9">${text}</div>`;
}

function clearResult() {
  resultEl.innerHTML = "";
}

function makePreview(src, filename = "") {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "16px";
  wrap.style.padding = "12px";
  wrap.style.borderRadius = "10px";
  wrap.style.background = "rgba(255,255,255,0.08)";
  wrap.style.border = "1px solid rgba(255,255,255,0.15)";

  const img = document.createElement("img");
  img.src = src;
  img.alt = filename || "preview";
  img.style.maxWidth = "320px";
  img.style.borderRadius = "8px";
  img.style.display = "block";
  img.style.margin = "0 auto 10px auto";
  wrap.appendChild(img);

  const label = document.createElement("div");
  label.style.fontSize = "12px";
  label.style.opacity = "0.85";
  label.textContent = filename || "ภาพจากกล้อง";
  wrap.appendChild(label);

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.marginTop = "8px";
  table.style.borderCollapse = "collapse";
  table.innerHTML = `
    <thead>
      <tr>
        <th style="text-align:left;padding:6px;border-bottom:1px solid rgba(255,255,255,.15)">Prediction</th>
        <th style="text-align:right;padding:6px;border-bottom:1px solid rgba(255,255,255,.15)">Confidence</th>
      </tr>
    </thead>
    <tbody></tbody>`;
  wrap.appendChild(table);

  resultEl.appendChild(wrap);
  return { imgEl: img, tbodyEl: table.querySelector("tbody") };
}

function renderTopK(tbodyEl, labeled, k = 3) {
  const rows = labeled.slice(0, k).map((r, i) => {
    const mark = i === 0 ? "✅ " : "";
    return `
      <tr>
        <td style="padding:6px">${mark}${r.label}</td>
        <td style="padding:6px;text-align:right">${(r.score * 100).toFixed(2)}%</td>
      </tr>`;
  }).join("");
  tbodyEl.innerHTML = rows;
}

/* ---------- 3) Core prediction ---------- */
async function predictFromImageElement(imgEl) {
  if (!model) {
    setStatus("โมเดลยังไม่พร้อม โปรดรอสักครู่…");
    return;
  }
  const probs = await tf.tidy(async () => {
    const t = tf.browser.fromPixels(imgEl)
      .resizeNearestNeighbor([224, 224]) // ปรับตามขนาดที่เทรน
      .toFloat()
      .div(255)
      .expandDims();                     // [1, 224, 224, 3]
    const p = model.predict(t);
    const data = await p.data();
    return Array.from(data);
  });

  const labeled = probs
    .map((v, i) => ({
      label: (metadata?.labels && metadata.labels[i]) ?? `Class ${i}`,
      score: v
    }))
    .sort((a, b) => b.score - a.score);

  return labeled;
}

/* ---------- 4) Handle File(s) ---------- */
async function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;
  clearResult();

  // รองรับหลายไฟล์ ถ้าในอนาคตคุณเพิ่ม attribute multiple ให้ input
  for (const file of fileList) {
    if (!file.type.startsWith("image/")) continue;

    const url = URL.createObjectURL(file);
    const { imgEl, tbodyEl } = makePreview(url, file.name);

    await new Promise(res => (imgEl.onload = res));
    const labeled = await predictFromImageElement(imgEl);
    renderTopK(tbodyEl, labeled, 3);
  }
}

/* ---------- 5) Handle Camera (capture input) ---------- */
async function handleCamera(fileList) {
  // บนมือถือ/เบราว์เซอร์ที่รองรับ จะได้ไฟล์ภาพจากกล้อง
  await handleFiles(fileList);
}

/* ---------- 6) Event bindings ---------- */
uploadInput.addEventListener("change", (e) => handleFiles(e.target.files));
cameraInput.addEventListener("change", (e) => handleCamera(e.target.files));

/* ---------- 7) Optional: drag & drop (ถ้าอยากใช้งาน เพิ่ม container แล้วผูกตรงนี้) ---------- */
// ตัวอย่างการใช้งานในอนาคต:
// const dropZone = document.getElementById("dropZone");
// ["dragenter","dragover"].forEach(ev => dropZone?.addEventListener(ev, e => { e.preventDefault(); }));
// dropZone?.addEventListener("drop", e => { e.preventDefault(); handleFiles(e.dataTransfer.files); });
