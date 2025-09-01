let model, metadata;

async function loadModel() {
  model = await tf.loadLayersModel("model/model.json");
  console.log("Model loaded");

  const metadataRes = await fetch("model/metadata.json");
  metadata = await metadataRes.json();
  console.log("Metadata loaded:", metadata);
}

async function predictImage(file) {
  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = async () => {
    let tensor = tf.browser.fromPixels(img)
      .resizeNearestNeighbor([224, 224])
      .toFloat()
      .expandDims();

    const prediction = await model.predict(tensor).data();
    const maxIndex = prediction.indexOf(Math.max(...prediction));

    document.getElementById("result").innerHTML =
      `<p>Prediction: <b>${metadata.labels[maxIndex]}</b></p>
       <p>Confidence: ${(prediction[maxIndex] * 100).toFixed(2)}%</p>`;
  };
}

document.getElementById("upload").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) predictImage(file);
});

loadModel();