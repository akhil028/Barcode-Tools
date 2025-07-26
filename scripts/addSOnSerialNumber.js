let originalData = [];
let originalFileName = "";
let originalFileType = "";
let columnHeaders = [];
let selectedColumns = [];
let operationMode = "";

document.getElementById("upload").addEventListener("change", handleFileUpload);
document.getElementById("separator").addEventListener("input", updatePreview);
document
  .getElementById("newColumnName")
  .addEventListener("input", updatePreview);

function updateStepStatus(stepNumber, status) {
  const stepElement = document.getElementById(`step${stepNumber}Number`);
  const stepCard =
    stepNumber === 1
      ? document.getElementById("uploadStep")
      : stepNumber === 2
      ? document.getElementById("modeStep")
      : stepNumber === 3
      ? document.getElementById("configStep")
      : document.getElementById("previewStep");

  stepElement.className = "step-number";
  stepCard.classList.remove("disabled");

  if (status === "active") {
    stepElement.classList.add("active");
  } else if (status === "completed") {
    stepElement.classList.add("completed");
  } else if (status === "disabled") {
    stepCard.classList.add("disabled");
  }
}

function showStatus(message, type = "info") {
  const statusDiv = document.getElementById("status");
  const alertClass =
    type === "success"
      ? "alert-success"
      : type === "error"
      ? "alert-danger"
      : "alert-info";
  const iconClass =
    type === "success"
      ? "bi-check-circle"
      : type === "error"
      ? "bi-exclamation-triangle"
      : "bi-info-circle";

  statusDiv.innerHTML = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
          <i class="bi ${iconClass}"></i> ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  clearAll(true);
  showStatus("Reading file, please wait...", "info");
  updateStepStatus(1, "active");

  originalFileName = file.name;
  originalFileType = file.name.split(".").pop().toLowerCase();

  try {
    const data = await readFile(file);
    originalData = data;

    if (originalData.length === 0) {
      throw new Error("File is empty or contains no readable data.");
    }

    // Extract column headers (first row)
    columnHeaders = originalData[0] || [];
    createColumnCheckboxes();

    // Update UI for successful file upload
    updateStepStatus(1, "completed");
    updateStepStatus(2, "active");

    document.getElementById("clearBtn").disabled = false;

    displayFileInfo();
    showStatus(
      `File "${originalFileName}" loaded successfully. Please choose an operation mode.`,
      "success"
    );

    // Scroll to mode selection
    document
      .getElementById("modeStep")
      .scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
    clearAll();
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target.result;
        const workbook =
          originalFileType === "csv"
            ? XLSX.read(fileContent, { type: "string" })
            : XLSX.read(new Uint8Array(fileContent), { type: "array" });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        resolve(jsonData);
      } catch (err) {
        reject(
          new Error(
            "Could not parse the file. Please ensure it is a valid Excel or CSV file."
          )
        );
      }
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));

    if (originalFileType === "csv") {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

function createColumnCheckboxes() {
  const checkboxContainer = document.getElementById("columnCheckboxes");
  checkboxContainer.innerHTML = "";

  columnHeaders.forEach((header, index) => {
    const columnName = header || `Column ${index + 1}`;
    const checkboxDiv = document.createElement("div");
    checkboxDiv.className = "form-check mb-2";
    checkboxDiv.innerHTML = `
          <input class="form-check-input" type="checkbox" value="${index}" id="column_${index}" onchange="updateSelectedColumns()">
          <label class="form-check-label" for="column_${index}">
            <strong>${columnName}</strong>
          </label>
        `;
    checkboxContainer.appendChild(checkboxDiv);
  });
}

function selectAllColumns() {
  const checkboxes = document.querySelectorAll(
    '#columnCheckboxes input[type="checkbox"]'
  );
  checkboxes.forEach((checkbox) => (checkbox.checked = true));
  updateSelectedColumns();
}

function deselectAllColumns() {
  const checkboxes = document.querySelectorAll(
    '#columnCheckboxes input[type="checkbox"]'
  );
  checkboxes.forEach((checkbox) => (checkbox.checked = false));
  updateSelectedColumns();
}

function selectOperationMode(mode) {
  operationMode = mode;

  // Update UI
  document
    .querySelectorAll(".operation-mode")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById(mode + "Mode").classList.add("active");

  // Show appropriate configuration
  document.getElementById("modifyConfig").style.display =
    mode === "modify" ? "block" : "none";
  document.getElementById("concatenateConfig").style.display =
    mode === "concatenate" ? "block" : "none";

  // Enable step 3
  updateStepStatus(2, "completed");
  updateStepStatus(3, "active");

  if (mode === "concatenate") {
    document.getElementById("separator").disabled = false;
    document.getElementById("newColumnName").disabled = false;
  }

  showStatus(
    `${
      mode === "modify" ? "Modify" : "Concatenate"
    } mode selected. Please select columns to work with.`,
    "info"
  );

  // Scroll to configuration
  document
    .getElementById("configStep")
    .scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateSelectedColumns() {
  const checkboxes = document.querySelectorAll(
    '#columnCheckboxes input[type="checkbox"]:checked'
  );
  selectedColumns = Array.from(checkboxes).map((checkbox) =>
    parseInt(checkbox.value)
  );

  updateColumnPreview();

  if (operationMode === "modify") {
    createColumnSettings();
  }

  if (selectedColumns.length > 0 && shouldUpdatePreview()) {
    updatePreview();
  }
}

function createColumnSettings() {
  const settingsContainer = document.getElementById("columnSettingsContainer");
  settingsContainer.innerHTML = "";

  selectedColumns.forEach((columnIndex) => {
    const columnName =
      columnHeaders[columnIndex] || `Column ${columnIndex + 1}`;
    const settingCard = document.createElement("div");
    settingCard.className = "column-config-card selected";
    settingCard.innerHTML = `
          <div class="column-header">
            <i class="bi bi-gear-fill"></i> ${columnName}
          </div>
          <div class="row g-3">
            <div class="col-md-6">
              <label for="string_${columnIndex}" class="form-label fw-bold">
                <i class="bi bi-type"></i> String to Add
              </label>
              <input type="text" class="form-control" id="string_${columnIndex}" 
                     placeholder="e.g. S, IMEI, BC-" onchange="updatePreview()">
              <div class="form-text">Text to add to this column</div>
            </div>
            <div class="col-md-6">
              <label for="position_${columnIndex}" class="form-label fw-bold">
                <i class="bi bi-arrow-left-right"></i> Position
              </label>
              <select class="form-select" id="position_${columnIndex}" onchange="updatePreview()">
                <option value="start">Add to Start (Prefix)</option>
                <option value="end">Add to End (Suffix)</option>
              </select>
              <div class="form-text">Where to add the string</div>
            </div>
          </div>
        `;
    settingsContainer.appendChild(settingCard);
  });
}

function shouldUpdatePreview() {
  if (operationMode === "modify") {
    return selectedColumns.some((columnIndex) => {
      const stringInput = document.getElementById(`string_${columnIndex}`);
      return stringInput && stringInput.value.trim() !== "";
    });
  } else if (operationMode === "concatenate") {
    const newColumnName = document.getElementById("newColumnName").value;
    return newColumnName.trim() !== "";
  }
  return false;
}

function displayFileInfo() {
  const fileInfoSection = document.getElementById("fileInfoSection");
  const fileInfoDiv = document.getElementById("fileInfo");

  fileInfoSection.style.display = "block";
  fileInfoDiv.innerHTML = `
        <div class="row">
          <div class="col-sm-4"><strong>File Name:</strong> ${originalFileName}</div>
          <div class="col-sm-4"><strong>Total Rows:</strong> ${originalData.length.toLocaleString()}</div>
          <div class="col-sm-4"><strong>Columns:</strong> ${
            columnHeaders.length
          }</div>
        </div>`;
}

function updateColumnPreview() {
  const columnPreview = document.getElementById("columnPreview");

  if (selectedColumns.length === 0) {
    columnPreview.innerHTML = "Select columns to see preview...";
    return;
  }

  let previewHTML = "";
  selectedColumns.forEach((columnIndex) => {
    const columnName =
      columnHeaders[columnIndex] || `Column ${columnIndex + 1}`;
    const values = originalData
      .slice(1, 4)
      .map((row, index) => {
        const value =
          row[columnIndex] != null ? row[columnIndex].toString() : "";
        return `<div class="mb-1"><span class="badge bg-secondary me-2">${
          index + 1
        }</span><code>${value}</code></div>`;
      })
      .join("");

    previewHTML += `
          <div class="mb-3">
            <div class="fw-bold text-primary">${columnName}</div>
            ${values}
          </div>
        `;
  });

  columnPreview.innerHTML = previewHTML;
}

function updatePreview() {
  if (originalData.length === 0 || selectedColumns.length === 0) return;

  if (operationMode === "modify") {
    updateModifyPreview();
  } else if (operationMode === "concatenate") {
    const newColumnName = document.getElementById("newColumnName").value;
    if (!newColumnName) return;
    updateConcatenatePreview();
  }
}

function updateModifyPreview() {
  // Check if at least one column has a string to add
  const hasValidSettings = selectedColumns.some((columnIndex) => {
    const stringInput = document.getElementById(`string_${columnIndex}`);
    return stringInput && stringInput.value.trim() !== "";
  });

  if (!hasValidSettings) return;

  // Enable preview step
  updateStepStatus(3, "completed");
  updateStepStatus(4, "active");
  document.getElementById("downloadBtn").disabled = false;

  // Create table header
  const headerRow = document.getElementById("previewTableHeader");
  headerRow.innerHTML = '<th width="8%">#</th>';

  selectedColumns.forEach((columnIndex) => {
    const columnName =
      columnHeaders[columnIndex] || `Column ${columnIndex + 1}`;
    headerRow.innerHTML += `<th>Original ${columnName}</th><th>Modified ${columnName}</th>`;
  });

  // Populate table body
  const tableBody = document.querySelector("#previewTable tbody");
  tableBody.innerHTML = "";

  const previewRows = originalData.slice(1, 51); // Skip header, show first 50 data rows
  let fragment = document.createDocumentFragment();

  previewRows.forEach((row, index) => {
    let rowHTML = `<td><span class="badge bg-secondary">${
      index + 1
    }</span></td>`;

    selectedColumns.forEach((columnIndex) => {
      const originalValue =
        row && row[columnIndex] != null ? row[columnIndex].toString() : "";
      const stringInput = document.getElementById(`string_${columnIndex}`);
      const positionSelect = document.getElementById(`position_${columnIndex}`);

      let modifiedValue = originalValue;

      if (
        stringInput &&
        stringInput.value.trim() !== "" &&
        originalValue !== ""
      ) {
        const concatStr = stringInput.value;
        const position = positionSelect ? positionSelect.value : "start";
        modifiedValue =
          position === "start"
            ? concatStr + originalValue
            : originalValue + concatStr;
      }

      rowHTML += `<td><code>${originalValue}</code></td><td><code class="text-primary fw-bold">${modifiedValue}</code></td>`;
    });

    const tr = document.createElement("tr");
    tr.innerHTML = rowHTML;
    fragment.appendChild(tr);
  });

  tableBody.appendChild(fragment);

  // Scroll to preview section
  document
    .getElementById("previewStep")
    .scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateConcatenatePreview() {
  const separator = document.getElementById("separator").value;
  const newColumnName = document.getElementById("newColumnName").value;

  // Enable preview step
  updateStepStatus(3, "completed");
  updateStepStatus(4, "active");
  document.getElementById("downloadBtn").disabled = false;

  // Create table header
  const headerRow = document.getElementById("previewTableHeader");
  headerRow.innerHTML = '<th width="8%">#</th>';

  selectedColumns.forEach((columnIndex) => {
    const columnName =
      columnHeaders[columnIndex] || `Column ${columnIndex + 1}`;
    headerRow.innerHTML += `<th>${columnName}</th>`;
  });
  headerRow.innerHTML += `<th class="table-success">New: ${newColumnName}</th>`;

  // Populate table body
  const tableBody = document.querySelector("#previewTable tbody");
  tableBody.innerHTML = "";

  const previewRows = originalData.slice(1, 51); // Skip header, show first 50 data rows
  let fragment = document.createDocumentFragment();

  previewRows.forEach((row, index) => {
    let rowHTML = `<td><span class="badge bg-secondary">${
      index + 1
    }</span></td>`;
    let concatenatedValue = "";

    // Show original column values
    selectedColumns.forEach((columnIndex, i) => {
      const value =
        row && row[columnIndex] != null ? row[columnIndex].toString() : "";
      rowHTML += `<td><code>${value}</code></td>`;

      // Build concatenated value
      if (value !== "") {
        concatenatedValue += value;
        if (i < selectedColumns.length - 1 && separator) {
          concatenatedValue += separator;
        }
      }
    });

    // Add new concatenated column
    rowHTML += `<td class="table-success"><code class="text-success fw-bold">${concatenatedValue}</code></td>`;

    const tr = document.createElement("tr");
    tr.innerHTML = rowHTML;
    fragment.appendChild(tr);
  });

  tableBody.appendChild(fragment);

  // Scroll to preview section
  document
    .getElementById("previewStep")
    .scrollIntoView({ behavior: "smooth", block: "center" });
}

function downloadModifiedFile() {
  if (originalData.length === 0 || selectedColumns.length === 0) {
    showStatus("Please upload a file and select columns!", "error");
    return;
  }

  showStatus("Processing file for download...", "info");

  const modifiedData = JSON.parse(JSON.stringify(originalData));

  if (operationMode === "modify") {
    // Modify selected columns with individual settings
    modifiedData.slice(1).forEach((row) => {
      selectedColumns.forEach((columnIndex) => {
        const stringInput = document.getElementById(`string_${columnIndex}`);
        const positionSelect = document.getElementById(
          `position_${columnIndex}`
        );

        if (
          stringInput &&
          stringInput.value.trim() !== "" &&
          row &&
          row[columnIndex] != null
        ) {
          const text = row[columnIndex].toString();
          const concatStr = stringInput.value;
          const position = positionSelect ? positionSelect.value : "start";
          row[columnIndex] =
            position === "start" ? concatStr + text : text + concatStr;
        }
      });
    });
  } else if (operationMode === "concatenate") {
    const separator = document.getElementById("separator").value;
    const newColumnName = document.getElementById("newColumnName").value;

    // Add new column header
    modifiedData[0].push(newColumnName);

    // Add concatenated values for each row
    modifiedData.slice(1).forEach((row) => {
      let concatenatedValue = "";
      selectedColumns.forEach((columnIndex, i) => {
        const value =
          row && row[columnIndex] != null ? row[columnIndex].toString() : "";
        if (value !== "") {
          concatenatedValue += value;
          if (i < selectedColumns.length - 1 && separator) {
            concatenatedValue += separator;
          }
        }
      });
      row.push(concatenatedValue);
    });
  }

  const newSheet = XLSX.utils.aoa_to_sheet(modifiedData);
  const newWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Sheet1");

  const baseName = originalFileName.replace(/\.[^/.]+$/, "");
  const outExt = originalFileType === "csv" ? ".csv" : ".xlsx";
  const operation = operationMode === "modify" ? "modified" : "concatenated";
  const fileName = `${baseName}_${operation}${outExt}`;

  XLSX.writeFile(newWorkbook, fileName);

  updateStepStatus(4, "completed");
  showStatus(`File "${fileName}" has been downloaded successfully!`, "success");
}

function clearAll(keepFileInput = false) {
  originalData = [];
  originalFileName = "";
  originalFileType = "";
  columnHeaders = [];
  selectedColumns = [];
  operationMode = "";

  if (!keepFileInput) {
    document.getElementById("upload").value = "";
  }

  // Reset operation mode
  document
    .querySelectorAll(".operation-mode")
    .forEach((el) => el.classList.remove("active"));

  // Clear checkboxes
  document.getElementById("columnCheckboxes").innerHTML = "";

  // Reset inputs
  document.getElementById("separator").value = "";
  document.getElementById("newColumnName").value = "";
  document.getElementById("separator").disabled = true;
  document.getElementById("newColumnName").disabled = true;

  // Clear column settings
  document.getElementById("columnSettingsContainer").innerHTML = "";

  // Hide sections
  document.getElementById("fileInfoSection").style.display = "none";
  document.getElementById("modifyConfig").style.display = "none";
  document.getElementById("concatenateConfig").style.display = "none";

  // Reset buttons
  document.getElementById("downloadBtn").disabled = true;
  if (!keepFileInput) {
    document.getElementById("clearBtn").disabled = true;
  }

  // Clear messages and preview
  document.getElementById("status").innerHTML = "";
  document.querySelector("#previewTable tbody").innerHTML = "";
  document.getElementById("previewTableHeader").innerHTML =
    '<th width="8%">#</th>';
  document.getElementById("columnPreview").innerHTML =
    "Select columns to see preview...";

  // Reset step status
  updateStepStatus(1, "active");
  updateStepStatus(2, "disabled");
  updateStepStatus(3, "disabled");
  updateStepStatus(4, "disabled");
}
