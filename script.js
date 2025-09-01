let model, metadata;

// โหลดโมเดล
async function loadModel() {
  model = await tf.loadLayersModel("model/model.json");
  const metadataRes = await fetch("model/metadata.json");
  metadata = await metadataRes.json();
  console.log("Model & Metadata Loaded ✅");
}
loadModel();

// ทำนายภาพ
async function predictImage(imgElement) {
  let tensor = tf.browser.fromPixels(imgElement)
    .resizeNearestNeighbor([224, 224])
    .toFloat()
    .expandDims();

  const prediction = await model.predict(tensor).data();
  const maxIndex = prediction.indexOf(Math.max(...prediction));

  document.getElementById("result").innerHTML = `
    📌 Prediction: <b>${metadata.labels[maxIndex]}</b><br>
    ✅ Confidence: ${(prediction[maxIndex] * 100).toFixed(2)}%
  `;
}

// แสดงภาพ preview
function showPreview(file) {
  const img = document.getElementById("preview");
  img.src = URL.createObjectURL(file);
  img.style.display = "block";
  img.onload = () => predictImage(img);
}

// อัปโหลดไฟล์
document.getElementById("upload").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) showPreview(file);
});

// ใช้กล้อง
document.getElementById("camera").addEventListener("click", async () => {
  const video = document.createElement("video");
  video.autoplay = true;
  video.style.display = "none";
  document.body.appendChild(video);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      const img = document.getElementById("preview");
      img.src = canvas.toDataURL("image/png");
      img.style.display = "block";

      predictImage(img);
      stream.getTracks().forEach(track => track.stop()); // ปิดกล้อง
      document.body.removeChild(video);
    };
  } catch (err) {
    alert("ไม่สามารถเข้าถึงกล้องได้ ❌");
    console.error(err);
  }
});
