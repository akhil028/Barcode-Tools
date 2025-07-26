let currentFileData = null;
let currentFileName = "";
let currentFileType = "";
let isProcessing = false;

document
  .getElementById("upload")
  .addEventListener("change", handleFileSelection);

async function handleFileSelection(event) {
  clearAll(true); // Clear previous results but keep file input
  const file = event.target.files[0];
  if (!file) return;

  const fileExtension = file.name.split(".").pop().toLowerCase();
  currentFileName = file.name.replace(/\.[^/.]+$/, ""); // Filename without extension
  currentFileType = ["xlsx", "xls"].includes(fileExtension) ? "xlsx" : "csv";

  if (!["xlsx", "xls", "csv"].includes(fileExtension)) {
    showStatus(
      "Please select a valid Excel (.xlsx, .xls) or CSV (.csv) file.",
      "danger"
    );
    return;
  }

  showStatus("Reading file...", "info");

  try {
    if (fileExtension === "csv") {
      await parseCSVFile(file);
    } else {
      await parseExcelFile(file);
    }

    displayFileInfo();
    document.getElementById("configSection").style.display = "block";
    document.getElementById("actionSection").style.display = "block";
    document.getElementById("clearBtn").style.display = "inline-block";
    showStatus(
      'File loaded successfully. Please confirm settings and click "Split".',
      "success"
    );
  } catch (error) {
    showStatus(`Error reading file: ${error.message}`, "danger");
  }
}

function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length)
          return reject(
            new Error("CSV parsing error: " + results.errors[0].message)
          );
        currentFileData = results.data.filter((row) =>
          row.some((cell) => cell && cell.toString().trim() !== "")
        );
        if (currentFileData.length === 0)
          return reject(
            new Error("CSV file is empty or contains no valid data.")
          );
        resolve();
      },
      error: (error) => reject(error),
    });
  });
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        currentFileData = rows.filter((row) =>
          row.some(
            (cell) =>
              cell !== undefined &&
              cell !== null &&
              cell.toString().trim() !== ""
          )
        );
        if (currentFileData.length === 0)
          return reject(
            new Error("Excel file is empty or contains no valid data.")
          );
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function displayFileInfo() {
  const fileInfo = document.getElementById("fileInfo");
  const totalRows = currentFileData.length;
  const headerRow = currentFileData[0] || [];
  const dataRows = Math.max(0, totalRows - 1);

  fileInfo.innerHTML = `
        <div class="alert alert-secondary mt-3">
          <h5 class="alert-heading"><i class="bi bi-file-earmark-text"></i> File Information</h5>
          <div class="row">
            <div class="col-md-6"><strong>File:</strong> ${currentFileName}.${currentFileType}</div>
            <div class="col-md-6"><strong>Total Rows:</strong> ${totalRows.toLocaleString()} (${dataRows.toLocaleString()} data rows)</div>
          </div>
          <hr>
          <p class="mb-0"><strong>Header Preview:</strong> <code>${headerRow
            .slice(0, 5)
            .join(", ")}${headerRow.length > 5 ? "..." : ""}</code></p>
        </div>
      `;
  fileInfo.style.display = "block";
}

async function splitAndZipFile() {
  if (isProcessing || !currentFileData) return;

  const rowCount = parseInt(document.getElementById("rowCount").value, 10);
  const headerOption = document.querySelector(
    'input[name="headerOption"]:checked'
  ).value;
  const splitBtn = document.getElementById("splitBtn");

  if (isNaN(rowCount) || rowCount <= 0) {
    showStatus("Please enter a valid row count.", "danger");
    return;
  }
  if (currentFileData.length < 2) {
    showStatus(
      "File must have at least one header and one data row.",
      "warning"
    );
    return;
  }

  isProcessing = true;
  splitBtn.disabled = true;
  splitBtn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';

  const outputDiv = document.getElementById("output");
  outputDiv.innerHTML = `
        <div class="progress" style="height: 25px;">
          <div id="progressFill" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
        </div>
        <div id="progressText" class="text-center mt-2">Initializing...</div>
      `;

  try {
    const zip = new JSZip();
    const headerRow = currentFileData[0];
    const dataRows = currentFileData.slice(1);
    const totalDataRows = dataRows.length;
    let fileCount = 0;

    for (let i = 0; i < totalDataRows; i += rowCount) {
      fileCount++;
      const chunk = dataRows.slice(i, i + rowCount);
      const fileData =
        headerOption === "include" ? [headerRow, ...chunk] : chunk;

      if (currentFileType === "csv") {
        const csvContent = Papa.unparse(fileData);
        zip.file(`${currentFileName}_Split_${fileCount}.csv`, csvContent);
      } else {
        const newWorkbook = XLSX.utils.book_new();
        const newSheet = XLSX.utils.aoa_to_sheet(fileData);
        XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Sheet1");
        const xlsxOutput = XLSX.write(newWorkbook, {
          bookType: "xlsx",
          type: "binary",
        });
        zip.file(
          `${currentFileName}_Split_${fileCount}.xlsx`,
          s2ab(xlsxOutput)
        );
      }

      const progress = Math.round(((i + chunk.length) / totalDataRows) * 100);
      updateProgress(progress, `Processed file ${fileCount}...`);
      await new Promise((resolve) => setTimeout(resolve, 0)); // Allow UI to update
    }

    updateProgress(100, `Generating ZIP file for ${fileCount} files...`);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    autoDownloadZip(zipBlob, `${currentFileName}_Split_Files.zip`);

    outputDiv.innerHTML = `
          <div class="alert alert-success">
            <h4 class="alert-heading"><i class="bi bi-check-circle-fill"></i> Success!</h4>
            <p>Successfully created ${fileCount} files and downloaded as a ZIP.</p>
            <hr>
            <p class="mb-0"><strong>Total data rows processed:</strong> ${totalDataRows.toLocaleString()}</p>
          </div>
        `;
  } catch (error) {
    showStatus(`Error during processing: ${error.message}`, "danger");
  } finally {
    isProcessing = false;
    splitBtn.disabled = false;
    splitBtn.innerHTML =
      '<i class="bi bi-play-circle"></i> Split and Create Zip';
  }
}

function updateProgress(percentage, text) {
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  if (progressFill) {
    progressFill.style.width = percentage + "%";
    progressFill.textContent = percentage + "%";
    progressFill.setAttribute("aria-valuenow", percentage);
  }
  if (progressText) {
    progressText.textContent = text;
  }
}

function s2ab(s) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) {
    view[i] = s.charCodeAt(i) & 0xff;
  }
  return buf;
}

function autoDownloadZip(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function showStatus(message, type = "info") {
  const outputDiv = document.getElementById("output");
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
  outputDiv.innerHTML = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
          <i class="bi ${iconClass} me-2"></i> ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;
}

function clearAll(keepInput = false) {
  currentFileData = null;
  currentFileName = "";
  currentFileType = "";
  isProcessing = false;

  if (!keepInput) {
    document.getElementById("upload").value = "";
  }

  document.getElementById("output").innerHTML = "";
  document.getElementById("fileInfo").style.display = "none";
  document.getElementById("configSection").style.display = "none";
  document.getElementById("actionSection").style.display = "none";
  document.getElementById("clearBtn").style.display = "none";
  document.getElementById("splitBtn").disabled = false;
  document.getElementById("splitBtn").innerHTML =
    '<i class="bi bi-play-circle"></i> Split and Create Zip';
}
