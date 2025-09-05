let model, metadata;

async function loadModel() {
    try {
        document.getElementById("status").innerText = "กำลังโหลดโมเดล…";
        model = await tf.loadLayersModel("model/model.json");
        const metadataRes = await fetch("model/metadata.json");
        metadata = await metadataRes.json();
        document.getElementById("status").innerText = "โมเดลพร้อมใช้งาน";
    } catch (err) {
        console.error(err);
        document.getElementById("status").innerText = "โหลดโมเดลไม่สำเร็จ";
    }
}

async function predictFromImageElement(imgEl) {
    if (!model) {
        document.getElementById("status").innerText = "โมเดลยังไม่พร้อม โปรดรอสักครู่...";
        return;
    }
    const probs = await tf.tidy(() => {
        const t = tf.browser.fromPixels(imgEl)
            .resizeNearestNeighbor([224, 224]) // ปรับขนาดเป็น 224x224
            .toFloat()
            .div(255)
            .expandDims();
        const p = model.predict(t);
        const data = p.dataSync();
        return Array.from(data);
    });

    const labeled = probs
        .map((v, i) => ({
            label: metadata?.labels[i] ?? `Class ${i}`,
            score: v
        }))
        .sort((a, b) => b.score - a.score);

    renderPrediction(labeled);
}

function renderPrediction(labeled) {
    const resultEl = document.getElementById("result");
    resultEl.innerHTML = `
        <p><strong>Prediction:</strong> ${labeled[0].label}</p>
        <p><strong>Confidence:</strong> ${(labeled[0].score * 100).toFixed(2)}%</p>
    `;
}

function handleFile(file) {
    if (!file.type.startsWith("image/")) {
        alert("กรุณาเลือกไฟล์รูปภาพ");
        return;
    }

    const url = URL.createObjectURL(file);
    const imgEl = new Image();
    imgEl.src = url;
    imgEl.onload = () => {
        predictFromImageElement(imgEl);
    };
}

document.getElementById("upload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    handleFile(file);
});

document.getElementById("camera").addEventListener("click", () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then((stream) => {
                const video = document.createElement('video');
                video.srcObject = stream;
                video.play();
                document.body.appendChild(video);
                video.onloadedmetadata = () => {
                    video.width = 224;
                    video.height = 224;
                    video.play();
                    const canvas = document.createElement('canvas');
                    canvas.width = 224;
                    canvas.height = 224;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, 224, 224);
                    const imgEl = new Image();
                    imgEl.src = canvas.toDataURL();
                    imgEl.onload = () => {
                        predictFromImageElement(imgEl);
                    };
                };
            }).catch((err) => {
                console.log("Error accessing camera:", err);
            });
    }
});

loadModel();
