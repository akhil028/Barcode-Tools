let productDetails = [];

document.getElementById("dataFile").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileExtension = file.name.split(".").pop().toLowerCase();

  showStatus("Reading file, please wait...", "info");

  if (fileExtension === "csv") {
    parseCSVFile(file);
  } else if (fileExtension === "xlsx" || fileExtension === "xls") {
    parseExcelFile(file);
  } else {
    showStatus("Please select a CSV or Excel file.", "danger");
  }
});

function parseCSVFile(file) {
  Papa.parse(file, {
    complete: function (results) {
      processData(results.data, file.name);
      enableGeneration();
    },
    error: function (error) {
      showStatus("Error parsing CSV file: " + error.message, "danger");
    },
  });
}

function parseExcelFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      // Get the first worksheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convert to array of arrays
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      processData(jsonData, file.name);
      enableGeneration();
    } catch (error) {
      showStatus("Error parsing Excel file: " + error.message, "danger");
    }
  };
  reader.onerror = () => showStatus("Failed to read file.", "danger");
  reader.readAsArrayBuffer(file);
}

function processData(data, fileName) {
  updateBaseDetails();

  const baseDetails = document.getElementById("baseDetails").value;
  const groupSize = parseInt(document.getElementById("groupSize").value);
  let currentGroup = [];
  productDetails = [];

  data.forEach((row, index) => {
    // Handle both array format and object format
    let cellValue;
    if (Array.isArray(row)) {
      cellValue = row[0];
    } else if (typeof row === "object" && row !== null) {
      const keys = Object.keys(row);
      cellValue = keys.length > 0 ? row[keys[0]] : "";
    } else {
      cellValue = row;
    }

    if (cellValue && cellValue.toString().trim() !== "") {
      currentGroup.push(cellValue.toString().trim());
      if (currentGroup.length === groupSize || index === data.length - 1) {
        productDetails.push(baseDetails + currentGroup.join(","));
        currentGroup = [];
      }
    } else if (currentGroup.length > 0) {
      productDetails.push(baseDetails + currentGroup.join(","));
      currentGroup = [];
      productDetails.push(""); // Add an empty string for the gap
    }
  });

  if (productDetails.length === 0) {
    showStatus(
      "No valid data found in the file. Please check your file format.",
      "warning"
    );
    return;
  }

  displayFileInfo(fileName, data.length, productDetails.length);
  generateBarcodes();
}

function updateBaseDetails() {
  const modelNumber = document.getElementById("modelNumber").value;
  const quantityInfo = document.getElementById("quantityInfo").value;
  let currentBase = document.getElementById("baseDetails").value;

  // Update the base details with new model number and quantity info
  if (modelNumber) {
    currentBase = currentBase.replace(/{Part Number}/g, modelNumber);
  }
  if (quantityInfo) {
    currentBase = currentBase.replace(/{QTY Info}/g, quantityInfo);
  }

  document.getElementById("baseDetails").value = currentBase;
}

function displayFileInfo(fileName, originalCount, groupCount) {
  const fileInfo = document.getElementById("fileInfo");
  const fileDetails = document.getElementById("fileDetails");

  fileDetails.innerHTML = `
        <div class="row">
          <div class="col-sm-4"><strong>File:</strong> ${fileName}</div>
          <div class="col-sm-4"><strong>Original Records:</strong> ${originalCount.toLocaleString()}</div>
          <div class="col-sm-4"><strong>Generated Groups:</strong> ${groupCount.toLocaleString()}</div>
        </div>
      `;

  fileInfo.style.display = "block";
}

function enableGeneration() {
  document.getElementById("generateBtn").disabled = false;
  document.getElementById("previewSection").style.display = "block";
  showStatus(
    `Successfully processed data. Generated ${productDetails.length.toLocaleString()} barcode groups. Ready to generate PDF!`,
    "success"
  );
}

function generateBarcodes() {
  const barcodesContainer = document.getElementById("barcodes");
  barcodesContainer.innerHTML = ""; // Clear previous barcodes

  const barcodeHeight = parseInt(
    document.getElementById("barcodeHeight").value
  );
  const dynamicText = document.getElementById("dynamicText").value;

  // Show first 10 barcodes for preview
  const previewCount = Math.min(productDetails.length, 10);

  productDetails.slice(0, previewCount).forEach((detail, index) => {
    if (detail) {
      const barcodeItem = document.createElement("div");
      barcodeItem.className = "barcode-item";

      const canvas = document.createElement("canvas");
      canvas.id = `barcode${index}`;
      barcodeItem.appendChild(canvas);

      // Generate the PDF417 barcode
      bwipjs.toCanvas(canvas, {
        bcid: "pdf417",
        text: detail,
        scale: 2,
        height: barcodeHeight,
      });

      // Add descriptive text below the barcode
      if (dynamicText) {
        const textElement = document.createElement("div");
        textElement.textContent = dynamicText;
        textElement.className = "mt-2 fw-bold";
        textElement.style.fontSize = "12px";
        barcodeItem.appendChild(textElement);
      }

      barcodesContainer.appendChild(barcodeItem);
    }
  });

  if (productDetails.length > previewCount) {
    const moreInfo = document.createElement("div");
    moreInfo.className = "alert alert-info mt-3";
    moreInfo.innerHTML = `
          <i class="bi bi-info-circle"></i> 
          Showing ${previewCount} of ${productDetails.length.toLocaleString()} barcodes in preview. 
          All ${productDetails.length.toLocaleString()} barcodes will be included in the PDF.
        `;
    barcodesContainer.appendChild(moreInfo);
  }
}

// Add event listeners to regenerate barcodes when settings change
[
  "barcodeWidth",
  "barcodeHeight",
  "columns",
  "rows",
  "dynamicText",
  "modelNumber",
  "quantityInfo",
  "groupSize",
  "baseDetails",
].forEach((id) => {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener("input", function () {
      if (productDetails.length > 0) {
        // Reprocess data with new settings
        const fileInput = document.getElementById("dataFile");
        if (fileInput.files[0]) {
          const file = fileInput.files[0];
          const fileExtension = file.name.split(".").pop().toLowerCase();

          if (fileExtension === "csv") {
            parseCSVFile(file);
          } else if (fileExtension === "xlsx" || fileExtension === "xls") {
            parseExcelFile(file);
          }
        }
      }
    });
  }
});

function generatePDF() {
  if (productDetails.length === 0) {
    showStatus("Please upload a file first!", "warning");
    return;
  }

  showStatus("Generating PDF, please wait...", "info");
  document.getElementById("generateBtn").disabled = true;
  document.getElementById("generateBtn").innerHTML =
    '<i class="bi bi-hourglass-split"></i> Generating...';

  const { jsPDF } = window.jspdf;
  const canvasElements = productDetails.map((_, index) => ({
    id: `barcode${index}`,
  }));

  const canvasToImageData = (canvasElement, callback) => {
    const imgData = canvasElement.toDataURL("image/png", 1.0);
    callback(imgData);
  };

  const processCanvases = (index, imageDataArray, callback) => {
    if (index >= canvasElements.length) {
      callback(imageDataArray);
      return;
    }

    const { id } = canvasElements[index];
    let canvasElement = document.getElementById(id);

    // If canvas doesn't exist in preview, create it temporarily
    if (!canvasElement && productDetails[index]) {
      canvasElement = document.createElement("canvas");
      const barcodeHeight = parseInt(
        document.getElementById("barcodeHeight").value
      );

      bwipjs.toCanvas(canvasElement, {
        bcid: "pdf417",
        text: productDetails[index],
        scale: 2,
        height: barcodeHeight,
      });
    }

    if (canvasElement instanceof HTMLCanvasElement && productDetails[index]) {
      canvasToImageData(canvasElement, (imgData) => {
        imageDataArray.push({ imgData, details: productDetails[index] });
        processCanvases(index + 1, imageDataArray, callback);
      });
    } else {
      imageDataArray.push({ imgData: null, details: "" });
      processCanvases(index + 1, imageDataArray, callback);
    }
  };

  processCanvases(0, [], (imageDataArray) => {
    const doc = new jsPDF();
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm

    // Get dynamic values from form inputs
    const barcodeWidth = parseInt(
      document.getElementById("barcodeWidth").value
    );
    const barcodeHeight = parseInt(
      document.getElementById("barcodeHeight").value
    );
    const columns = parseInt(document.getElementById("columns").value);
    const rows = parseInt(document.getElementById("rows").value);
    const dynamicText = document.getElementById("dynamicText").value;
    const textMargin = 10;

    // Calculate equal margins to center barcodes on the page
    const horizontalMargin =
      (pageWidth - columns * barcodeWidth) / (columns + 1);
    const verticalMargin =
      (pageHeight - rows * (barcodeHeight + textMargin)) / (rows + 1);

    imageDataArray.forEach((data, index) => {
      if (data.imgData) {
        if (index > 0 && index % (columns * rows) === 0) {
          doc.addPage();
        }

        const column = index % columns;
        const row = Math.floor((index % (columns * rows)) / columns);

        const x = horizontalMargin + column * (barcodeWidth + horizontalMargin);
        const y =
          verticalMargin + row * (barcodeHeight + textMargin + verticalMargin);

        // Add the barcode image
        doc.addImage(data.imgData, "PNG", x, y, barcodeWidth, barcodeHeight);

        // Add descriptive text below the barcode
        if (dynamicText) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(
            dynamicText,
            x + barcodeWidth / 2,
            y + barcodeHeight + textMargin,
            {
              align: "center",
            }
          );
        }
      }
    });

    // Generate filename with dynamic text (sanitized for filename)
    const sanitizedText = dynamicText
      ? dynamicText.replace(/[^a-zA-Z0-9]/g, "_")
      : "pdf417";
    const fileName = `${sanitizedText}_SNo_${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    doc.save(fileName);

    // Reset button
    document.getElementById("generateBtn").disabled = false;
    document.getElementById("generateBtn").innerHTML =
      '<i class="bi bi-file-earmark-pdf"></i> Generate PDF';

    showStatus(`PDF generated successfully: ${fileName}`, "success");
  });
}

function showStatus(message, type = "info") {
  const statusDiv = document.getElementById("statusMessages");
  const alertClass =
    type === "success"
      ? "alert-success"
      : type === "danger"
      ? "alert-danger"
      : type === "warning"
      ? "alert-warning"
      : "alert-info";
  const iconClass =
    type === "success"
      ? "bi-check-circle"
      : type === "danger"
      ? "bi-exclamation-triangle"
      : type === "warning"
      ? "bi-exclamation-triangle"
      : "bi-info-circle";

  statusDiv.innerHTML = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
          <i class="bi ${iconClass}"></i> ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;

  // Auto-dismiss info messages after 5 seconds
  if (type === "info") {
    setTimeout(() => {
      const alert = statusDiv.querySelector(".alert");
      if (alert) {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }
    }, 5000);
  }
}

function clearAll() {
  productDetails = [];
  document.getElementById("dataFile").value = "";
  document.getElementById("barcodes").innerHTML = "";
  document.getElementById("generateBtn").disabled = true;
  document.getElementById("previewSection").style.display = "none";
  document.getElementById("fileInfo").style.display = "none";
  document.getElementById("statusMessages").innerHTML = "";

  // Reset form values to defaults
  document.getElementById("modelNumber").value = "";
  document.getElementById("quantityInfo").value = "";
  document.getElementById("baseDetails").value =
    "V3,SSCC001959494854252373,GTIN00194252099230,SCC30194252099231,{Part Number},{QTY Info},";

  showStatus("All data cleared. Please upload a new file.", "info");
}
