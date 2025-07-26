let generatedData = [];
let isGenerating = false;

// Generate sample data for preview
function generateSample() {
  const sample = generateBaseSerialNumber();
  const boxId = generateBoxId();

  document.getElementById("sampleSerial").textContent = sample;
  document.getElementById("sampleSerialNoS").textContent = sample;
  document.getElementById("sampleBoxId").textContent = boxId;
}

function generateBaseSerialNumber() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const charLength = characters.length;
  let result = "";
  for (let i = 0; i < 9; i++) {
    result += characters.charAt(Math.floor(Math.random() * charLength));
  }
  return result;
}

function generateBoxId() {
  const prefix = document.getElementById("boxIdPrefix").value.trim();
  const randomDigits =
    parseInt(document.getElementById("randomDigits").value) || 10;
  let result = prefix;
  for (let i = 0; i < randomDigits; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

function showStatus(message, type = "info") {
  const statusDiv = document.getElementById("statusMessages");
  const alertClass =
    type === "success"
      ? "alert-success"
      : type === "danger"
      ? "alert-danger"
      : "alert-info";
  const iconClass =
    type === "success"
      ? "bi-check-circle-fill"
      : type === "danger"
      ? "bi-exclamation-triangle-fill"
      : "bi-info-circle-fill";

  statusDiv.innerHTML = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
          <i class="bi ${iconClass} me-2"></i> ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;
}

function updateProgress(current, total) {
  const percentage = Math.round((current / total) * 100);
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");

  progressFill.style.width = percentage + "%";
  progressFill.textContent = percentage + "%";
  progressFill.setAttribute("aria-valuenow", percentage);
  progressText.textContent = `Generated ${current.toLocaleString()} of ${total.toLocaleString()} items`;
}

function updateStats(total, boxIds, time, speed) {
  document.getElementById("totalGenerated").textContent =
    total.toLocaleString();
  document.getElementById("totalBoxIds").textContent = boxIds.toLocaleString();
  document.getElementById("generationTime").textContent = time + "s";
  document.getElementById("generationSpeed").textContent =
    speed.toLocaleString();
}

async function generateStrings() {
  if (isGenerating) return;

  const numSerials = parseInt(document.getElementById("numSerials").value);
  const boxIdInterval = parseInt(
    document.getElementById("boxIdInterval").value
  );
  const previewCount = parseInt(document.getElementById("previewCount").value);
  const boxIdPrefix = document.getElementById("boxIdPrefix").value.trim();

  if (
    !numSerials ||
    numSerials <= 0 ||
    !boxIdInterval ||
    boxIdInterval <= 0 ||
    !boxIdPrefix
  ) {
    showStatus(
      "Please ensure all configuration fields are filled correctly.",
      "danger"
    );
    return;
  }

  isGenerating = true;
  const startTime = Date.now();

  // UI updates for generating state
  document.getElementById("progressAndStatsSection").style.display = "block";
  const generateBtn = document.getElementById("generateBtn");
  generateBtn.disabled = true;
  generateBtn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';

  const resultsTableBody = document.querySelector("#resultsTable tbody");
  resultsTableBody.innerHTML = "";
  generatedData = [];

  showStatus(
    `Starting generation of ${numSerials.toLocaleString()} serials...`,
    "info"
  );

  let currentBoxId = generateBoxId();
  const uniqueBoxIds = new Set();
  const batchSize = 1000;

  try {
    for (let i = 0; i < numSerials; i += batchSize) {
      const currentBatch = Math.min(batchSize, numSerials - i);
      const fragment = document.createDocumentFragment();

      for (let j = 0; j < currentBatch; j++) {
        const index = i + j;
        const baseSerialNumber = generateBaseSerialNumber();
        const serialWithS = "S" + baseSerialNumber;
        const serialWithoutS = baseSerialNumber;

        if (index > 0 && index % boxIdInterval === 0) {
          currentBoxId = generateBoxId();
        }
        uniqueBoxIds.add(currentBoxId);

        if (index < previewCount) {
          const row = document.createElement("tr");
          row.innerHTML = `<td>${
            index + 1
          }</td><td>${serialWithS}</td><td>${serialWithoutS}</td><td>${currentBoxId}</td>`;
          fragment.appendChild(row);
        }

        generatedData.push([serialWithS, serialWithoutS, currentBoxId]);
      }

      if (i < previewCount) {
        resultsTableBody.appendChild(fragment);
      }

      const currentTime = Date.now();
      const elapsed = Math.round((currentTime - startTime) / 1000);
      const speed = elapsed > 0 ? Math.round((i + currentBatch) / elapsed) : 0;

      updateProgress(i + currentBatch, numSerials);
      updateStats(i + currentBatch, uniqueBoxIds.size, elapsed, speed);

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    document.getElementById("previewSection").style.display = "block";
    document.getElementById("downloadBtn").disabled = false;
    document.getElementById("downloadCSVBtn").disabled = false;

    showStatus(
      `Successfully generated ${numSerials.toLocaleString()} serials in ${totalTime}s`,
      "success"
    );
  } catch (error) {
    showStatus(`Error during generation: ${error.message}`, "danger");
  } finally {
    isGenerating = false;
    generateBtn.disabled = false;
    generateBtn.innerHTML =
      '<i class="bi bi-rocket-launch"></i> Generate Strings';
  }
}

function downloadExcel() {
  if (!generatedData.length) return;
  showStatus("Preparing Excel file...", "info");

  const ws = XLSX.utils.aoa_to_sheet([
    ["Serial Number (With S)", "Serial Number (Without S)", "Box ID"],
    ...generatedData,
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Generated Strings");

  const fileName = `Generated_Strings_${
    new Date().toISOString().split("T")[0]
  }.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function downloadCSV() {
  if (!generatedData.length) return;
  showStatus("Preparing CSV file...", "info");

  let csvContent = "Serial Number (With S),Serial Number (Without S),Box ID\n";
  csvContent += generatedData
    .map((row) => row.map((item) => `"${item}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Generated_Strings_${
    new Date().toISOString().split("T")[0]
  }.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function clearResults() {
  generatedData = [];
  document.querySelector("#resultsTable tbody").innerHTML = "";
  document.getElementById("previewSection").style.display = "none";
  document.getElementById("progressAndStatsSection").style.display = "none";
  document.getElementById("downloadBtn").disabled = true;
  document.getElementById("downloadCSVBtn").disabled = true;
  showStatus("Results cleared.", "info");
}

// Initial setup
window.onload = generateSample;
