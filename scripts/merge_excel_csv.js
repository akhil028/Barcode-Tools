let selectedFiles = [];
let isProcessing = false;

document
  .getElementById("files")
  .addEventListener("change", handleFileSelection);
document.getElementById("mergeBtn").addEventListener("click", mergeFiles);

function handleFileSelection(event) {
  const files = Array.from(event.target.files);
  const fileInput = document.getElementById("files");
  const validation = document.getElementById("fileValidation");

  fileInput.classList.remove("is-invalid");
  validation.textContent = "";

  if (files.length > 10) {
    validation.textContent =
      "Maximum 10 files allowed. Please select fewer files.";
    fileInput.classList.add("is-invalid");
    resetUI();
    return;
  }

  const validExtensions = ["xlsx", "xls", "csv"];
  const invalidFiles = files.filter(
    (f) => !validExtensions.includes(f.name.split(".").pop().toLowerCase())
  );

  if (invalidFiles.length > 0) {
    validation.textContent = `Invalid file type(s): ${invalidFiles
      .map((f) => f.name)
      .join(", ")}.`;
    fileInput.classList.add("is-invalid");
    resetUI();
    return;
  }

  selectedFiles = files;
  displayFileList();

  if (selectedFiles.length >= 2) {
    document.getElementById("configSection").style.display = "block";
    document.getElementById("actionSection").style.display = "block";
  } else {
    resetUI();
  }
}

function displayFileList() {
  const fileListDiv = document.getElementById("fileList");
  if (selectedFiles.length === 0) {
    fileListDiv.style.display = "none";
    return;
  }

  const fileItemsHtml = selectedFiles
    .map(
      (file, index) => `
        <div class="list-group-item d-flex justify-content-between align-items-center file-item">
          <div>
            <div class="file-name"><i class="bi bi-file-earmark-spreadsheet me-2"></i>${
              file.name
            }</div>
            <div class="file-size">${formatFileSize(file.size)}</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="removeFile(${index})" title="Remove ${
        file.name
      }">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      `
    )
    .join("");

  fileListDiv.innerHTML = `<ul class="list-group">${fileItemsHtml}</ul>`;
  fileListDiv.style.display = "block";
}

function removeFile(index) {
  selectedFiles.splice(index, 1);

  const dt = new DataTransfer();
  selectedFiles.forEach((file) => dt.items.add(file));
  document.getElementById("files").files = dt.files;

  handleFileSelection({ target: { files: dt.files } });
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function mergeFiles() {
  if (isProcessing || selectedFiles.length < 2) return;

  isProcessing = true;
  const mergeBtn = document.getElementById("mergeBtn");
  mergeBtn.disabled = true;
  mergeBtn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Merging...';

  const headerOption = document.querySelector(
    'input[name="headerOption"]:checked'
  ).value;
  const statusDiv = document.getElementById("status");
  statusDiv.innerHTML = `
        <div class="progress" style="height: 25px;">
          <div id="progressFill" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
        </div>
        <div id="progressText" class="text-center mt-2">Initializing...</div>
      `;

  try {
    const allRows = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      updateProgress(
        (i / selectedFiles.length) * 100,
        `Reading file ${i + 1} of ${selectedFiles.length}: ${
          selectedFiles[i].name
        }`
      );

      const file = selectedFiles[i];
      const ext = file.name.split(".").pop().toLowerCase();
      let data;

      if (ext === "csv") {
        data = await readFileAsync(file, "readAsText");
      } else {
        data = await readFileAsync(file, "readAsArrayBuffer");
      }

      const workbook =
        ext === "csv"
          ? XLSX.read(data, { type: "binary" })
          : XLSX.read(new Uint8Array(data), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length === 0) continue;

      if (headerOption === "all") {
        allRows.push(...rows);
      } else {
        allRows.push(...(i === 0 ? rows : rows.slice(1)));
      }
    }

    updateProgress(100, "Building merged workbook...");
    const newWb = XLSX.utils.book_new();
    const newWs = XLSX.utils.aoa_to_sheet(allRows);
    XLSX.utils.book_append_sheet(newWb, newWs, "Merged_Data");

    updateProgress(100, "Generating final file...");
    const wbout = XLSX.write(newWb, { bookType: "xlsx", type: "binary" });
    const blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });

    autoDownload(
      blob,
      `Merged_Files_${new Date().toISOString().split("T")[0]}.xlsx`
    );

    statusDiv.innerHTML = `
          <div class="alert alert-success">
            <h4 class="alert-heading"><i class="bi bi-check-circle-fill"></i> Merge Complete!</h4>
            <p>Successfully merged ${
              selectedFiles.length
            } files into a single Excel file.</p>
            <hr>
            <p class="mb-0"><strong>Total rows in new file:</strong> ${allRows.length.toLocaleString()}</p>
          </div>
        `;
  } catch (error) {
    statusDiv.innerHTML = `
          <div class="alert alert-danger">
            <h4 class="alert-heading"><i class="bi bi-exclamation-triangle-fill"></i> Error</h4>
            <p>${error.message}</p>
          </div>`;
  } finally {
    isProcessing = false;
    mergeBtn.disabled = false;
    mergeBtn.innerHTML =
      '<i class="bi bi-play-circle"></i> Merge Files and Download';
  }
}

function updateProgress(percentage, text) {
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  if (progressFill) {
    progressFill.style.width = percentage + "%";
    progressFill.textContent = Math.round(percentage) + "%";
    progressFill.setAttribute("aria-valuenow", percentage);
  }
  if (progressText) {
    progressText.textContent = text;
  }
}

function readFileAsync(file, method) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader[method](file);
  });
}

function s2ab(s) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
  return buf;
}

function autoDownload(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function resetUI() {
  document.getElementById("fileList").style.display = "none";
  document.getElementById("configSection").style.display = "none";
  document.getElementById("actionSection").style.display = "none";
  document.getElementById("status").innerHTML = "";
}

function clearFiles() {
  selectedFiles = [];
  document.getElementById("files").value = "";
  resetUI();
}
