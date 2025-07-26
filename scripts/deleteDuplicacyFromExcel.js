let currentData = [];
let currentHeaders = [];
let currentFileType = "";
let isProcessing = false;

document
  .getElementById("fileInput")
  .addEventListener("change", handleFileSelection);
document
  .getElementsByName("checkMethod")
  .forEach((radio) => radio.addEventListener("change", toggleColumnSelection));

function toggleColumnSelection() {
  const columnSelection = document.getElementById("columnSelection");
  if (
    document.getElementById("checkSpecificColumns").checked &&
    currentHeaders.length > 0
  ) {
    columnSelection.style.display = "block";
  } else {
    columnSelection.style.display = "none";
  }
}

async function handleFileSelection(e) {
  clearAll(true);
  const file = e.target.files[0];
  if (!file) return;

  const fileExtension = file.name.split(".").pop().toLowerCase();
  currentFileType = ["xlsx", "xls"].includes(fileExtension) ? "xlsx" : "csv";

  showStatus("Reading file...", "info");

  try {
    if (currentFileType === "csv") {
      await parseCSVFile(file);
    } else {
      await parseExcelFile(file);
    }

    displayFileInfo(file);
    populateColumnList();

    document.getElementById("configSection").style.display = "block";
    document.getElementById("actionSection").style.display = "block";
    showStatus(
      'File loaded. Please configure your settings and click "Remove Duplicates".',
      "success"
    );
  } catch (error) {
    showStatus(`Error reading file: ${error.message}`, "danger");
    clearAll();
  }
}

function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length)
          return reject(new Error(results.errors[0].message));
        currentData = results.data.filter((row) =>
          row.some((cell) => cell && cell.toString().trim() !== "")
        );
        if (currentData.length < 2)
          return reject(
            new Error("File must contain a header and at least one data row.")
          );
        currentHeaders = currentData[0];
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
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        currentData = jsonData.filter((row) =>
          row.some(
            (cell) =>
              cell !== null &&
              cell !== undefined &&
              cell.toString().trim() !== ""
          )
        );
        if (currentData.length < 2)
          return reject(
            new Error("File must contain a header and at least one data row.")
          );
        currentHeaders = currentData[0];
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}

function displayFileInfo(file) {
  const fileInfo = document.getElementById("fileInfo");
  fileInfo.innerHTML = `
        <div class="alert alert-secondary mt-3">
          <h5 class="alert-heading"><i class="bi bi-file-earmark-text"></i> File Information</h5>
          <div class="row">
            <div class="col-md-6"><strong>File:</strong> ${file.name}</div>
            <div class="col-md-6"><strong>Total Rows:</strong> ${currentData.length.toLocaleString()} (${(
    currentData.length - 1
  ).toLocaleString()} data rows)</div>
          </div>
        </div>
      `;
  fileInfo.style.display = "block";
}

function populateColumnList() {
  const columnList = document.getElementById("columnList");
  columnList.innerHTML = currentHeaders
    .map(
      (header, index) => `
        <div class="col-md-4">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" value="${index}" id="column_${index}" checked>
            <label class="form-check-label" for="column_${index}">${
        header || `Column ${index + 1}`
      }</label>
          </div>
        </div>
      `
    )
    .join("");
}

function selectAllColumns() {
  document
    .querySelectorAll('#columnList input[type="checkbox"]')
    .forEach((cb) => (cb.checked = true));
}
function deselectAllColumns() {
  document
    .querySelectorAll('#columnList input[type="checkbox"]')
    .forEach((cb) => (cb.checked = false));
}

function processFile() {
  if (isProcessing || currentData.length === 0) return;

  const checkMethod = document.querySelector(
    'input[name="checkMethod"]:checked'
  ).value;
  let selectedColumns = [];

  if (checkMethod === "specific") {
    selectedColumns = Array.from(
      document.querySelectorAll("#columnList input:checked")
    ).map((cb) => parseInt(cb.value));
    if (selectedColumns.length === 0) {
      showStatus(
        "Please select at least one column to check for duplicates.",
        "warning"
      );
      return;
    }
  }

  isProcessing = true;
  const processBtn = document.getElementById("processBtn");
  processBtn.disabled = true;
  processBtn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';

  showStatus("Removing duplicates...", "info");

  setTimeout(() => {
    try {
      const { uniqueData, duplicateCount } = removeDuplicateRows(
        currentData,
        checkMethod,
        selectedColumns
      );

      displayResults(duplicateCount, currentData.length, uniqueData.length);
      downloadProcessedFile(uniqueData);
    } catch (error) {
      showStatus(`An error occurred: ${error.message}`, "danger");
    } finally {
      isProcessing = false;
      processBtn.disabled = false;
      processBtn.innerHTML =
        '<i class="bi bi-trash"></i> Remove Duplicates and Download';
    }
  }, 100);
}

function removeDuplicateRows(data, checkMethod, selectedColumns) {
  const headers = data[0];
  const dataRows = data.slice(1);
  const seen = new Set();
  const uniqueRows = [];

  dataRows.forEach((row) => {
    const key =
      checkMethod === "all"
        ? JSON.stringify(row)
        : JSON.stringify(selectedColumns.map((index) => row[index]));

    if (!seen.has(key)) {
      seen.add(key);
      uniqueRows.push(row);
    }
  });

  const duplicateCount = dataRows.length - uniqueRows.length;
  return { uniqueData: [headers, ...uniqueRows], duplicateCount };
}

function displayResults(duplicateCount, originalCount, uniqueCount) {
  const message =
    duplicateCount > 0
      ? `Removed <strong>${duplicateCount.toLocaleString()}</strong> duplicate row(s).`
      : `No duplicate rows found.`;
  const details = `Original data rows: ${
    originalCount - 1
  } | Final unique data rows: ${uniqueCount - 1}`;
  showStatus(`${message}<hr>${details}`, "success");
}

function downloadProcessedFile(data) {
  const fileName = `unique_data_${new Date().toISOString().split("T")[0]}`;
  if (currentFileType === "csv") {
    const csv = Papa.unparse(data);
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `${fileName}.csv`
    );
  } else {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Unique Data");
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "binary" });
    saveAs(
      new Blob([s2ab(wbout)], { type: "application/octet-stream" }),
      `${fileName}.xlsx`
    );
  }
}

function s2ab(s) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
  return buf;
}

function showStatus(message, type = "info") {
  const statusDiv = document.getElementById("status");
  const alertClass =
    type === "success"
      ? "alert-success"
      : type === "danger"
      ? "alert-danger"
      : "alert-warning";
  const iconClass =
    type === "success"
      ? "bi-check-circle-fill"
      : type === "danger"
      ? "bi-exclamation-triangle-fill"
      : "bi-shield-check";
  statusDiv.innerHTML = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
          <i class="bi ${iconClass} me-2"></i> <div>${message}</div>
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;
}

function clearAll(keepInput = false) {
  currentData = [];
  currentHeaders = [];
  isProcessing = false;

  if (!keepInput) {
    document.getElementById("fileInput").value = "";
  }

  document.getElementById("fileInfo").style.display = "none";
  document.getElementById("configSection").style.display = "none";
  document.getElementById("actionSection").style.display = "none";
  document.getElementById("columnSelection").style.display = "none";
  document.getElementById("status").innerHTML = "";

  const processBtn = document.getElementById("processBtn");
  processBtn.disabled = false;
  processBtn.innerHTML =
    '<i class="bi bi-trash"></i> Remove Duplicates and Download';
}
