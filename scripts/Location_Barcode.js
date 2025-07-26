let barcodeData = [];

// Add event listeners to regenerate barcodes when settings change
["barcodeWidth", "barcodeHeight", "columns", "rows", "barcodePrefix"].forEach(
  (id) => {
    document.getElementById(id).addEventListener("input", function () {
      if (barcodeData.length > 0) {
        regenerateBarcodes();
      }
    });
  }
);

function generateBarcodes() {
  const count = document.getElementById("barcodeCount").value;
  const prefix = document.getElementById("barcodePrefix").value.trim();

  if (!count || count <= 0) {
    showStatus("Please enter a valid number of barcodes.", "warning");
    return;
  }

  if (!prefix) {
    showStatus("Please enter a barcode prefix.", "warning");
    return;
  }

  if (count > 1000) {
    showStatus("Maximum 1000 barcodes allowed at once.", "warning");
    return;
  }

  showStatus("Generating barcodes, please wait...", "info");

  barcodeData = Array.from(
    { length: parseInt(count) },
    (_, i) => `${prefix}${String(i + 1).padStart(3, "0")}`
  );

  document.getElementById("generatePdfBtn").disabled = false;
  document.getElementById("previewSection").style.display = "block";

  displayGenerationInfo(prefix, count);
  renderBarcodes();

  showStatus(
    `Successfully generated ${count} location barcodes with prefix "${prefix}".`,
    "success"
  );
}

function regenerateBarcodes() {
  const count = barcodeData.length;
  const prefix = document.getElementById("barcodePrefix").value.trim();

  if (!prefix) {
    showStatus("Please enter a barcode prefix.", "warning");
    return;
  }

  barcodeData = Array.from(
    { length: count },
    (_, i) => `${prefix}${String(i + 1).padStart(3, "0")}`
  );

  displayGenerationInfo(prefix, count);
  renderBarcodes();
}

function displayGenerationInfo(prefix, count) {
  const generationInfo = document.getElementById("generationInfo");
  const generationDetails = document.getElementById("generationDetails");

  const firstCode = `${prefix}001`;
  const lastCode = `${prefix}${String(count).padStart(3, "0")}`;

  generationDetails.innerHTML = `
        <div class="row">
          <div class="col-sm-4"><strong>Prefix:</strong> ${prefix}</div>
          <div class="col-sm-4"><strong>Count:</strong> ${count.toLocaleString()}</div>
          <div class="col-sm-4"><strong>Range:</strong> ${firstCode} - ${lastCode}</div>
        </div>
      `;

  generationInfo.style.display = "block";
}

function renderBarcodes() {
  const barcodesContainer = document.getElementById("barcodes");
  barcodesContainer.innerHTML = ""; // Clear previous barcodes

  const barcodeHeight = parseInt(
    document.getElementById("barcodeHeight").value
  );

  // Show first 20 barcodes for preview
  const previewCount = Math.min(barcodeData.length, 20);

  barcodeData.slice(0, previewCount).forEach((data, index) => {
    const barcodeItem = document.createElement("div");
    barcodeItem.className = "barcode-item";

    const canvas = document.createElement("canvas");
    canvas.id = `barcode${index}`;
    barcodeItem.appendChild(canvas);

    // Generate the CODE128 barcode
    bwipjs.toCanvas(canvas, {
      bcid: "code128", // Set barcode type to CODE128
      text: data,
      scale: 2,
      height: barcodeHeight,
    });

    // Add descriptive text below the barcode
    const textElement = document.createElement("div");
    textElement.textContent = data; // Use barcode data as descriptive text
    textElement.className = "barcode-text";
    barcodeItem.appendChild(textElement);

    barcodesContainer.appendChild(barcodeItem);
  });

  if (barcodeData.length > previewCount) {
    const moreInfo = document.createElement("div");
    moreInfo.className = "alert alert-info mt-3";
    moreInfo.innerHTML = `
          <i class="bi bi-info-circle"></i> 
          Showing ${previewCount} of ${barcodeData.length.toLocaleString()} barcodes in preview. 
          All ${barcodeData.length.toLocaleString()} barcodes will be included in the PDF.
        `;
    barcodesContainer.appendChild(moreInfo);
  }
}

function generatePDF() {
  if (barcodeData.length === 0) {
    showStatus("Please generate barcodes first!", "warning");
    return;
  }

  showStatus("Generating PDF, please wait...", "info");
  document.getElementById("generatePdfBtn").disabled = true;
  document.getElementById("generatePdfBtn").innerHTML =
    '<i class="bi bi-hourglass-split"></i> Generating...';

  const { jsPDF } = window.jspdf;
  const canvasElements = barcodeData.map((_, index) => ({
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
    if (!canvasElement) {
      canvasElement = document.createElement("canvas");
      const barcodeHeight = parseInt(
        document.getElementById("barcodeHeight").value
      );

      bwipjs.toCanvas(canvasElement, {
        bcid: "code128",
        text: barcodeData[index],
        scale: 2,
        height: barcodeHeight,
      });
    }

    if (canvasElement instanceof HTMLCanvasElement) {
      canvasToImageData(canvasElement, (imgData) => {
        imageDataArray.push({ imgData, details: barcodeData[index] });
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
    const textHeight = 15; // Height of the text in mm
    const textMargin = 5; // Margin between barcode and text

    // Calculate equal margins to center barcodes on the page
    const horizontalMargin =
      (pageWidth - columns * barcodeWidth) / (columns + 1);
    const verticalMargin =
      (pageHeight - rows * (barcodeHeight + textHeight + textMargin)) /
      (rows + 1);

    imageDataArray.forEach((data, index) => {
      if (data.imgData) {
        if (index > 0 && index % (columns * rows) === 0) {
          doc.addPage();
        }

        const column = index % columns;
        const row = Math.floor((index % (columns * rows)) / columns);

        const x = horizontalMargin + column * (barcodeWidth + horizontalMargin);
        const y =
          verticalMargin +
          row * (barcodeHeight + textHeight + textMargin + verticalMargin);

        // Add the barcode image
        doc.addImage(data.imgData, "PNG", x, y, barcodeWidth, barcodeHeight);

        // Add descriptive text below the barcode with the barcode data
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15); // Increase font size for text
        doc.text(
          data.details,
          x + barcodeWidth / 2,
          y + barcodeHeight + textHeight / 2,
          {
            align: "center",
          }
        );
      }
    });

    // Generate filename with prefix
    const prefix = document.getElementById("barcodePrefix").value.trim();
    const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `location_code128_${sanitizedPrefix}_${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    doc.save(fileName);

    // Reset button
    document.getElementById("generatePdfBtn").disabled = false;
    document.getElementById("generatePdfBtn").innerHTML =
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
  barcodeData = [];
  document.getElementById("barcodeCount").value = "";
  document.getElementById("barcodes").innerHTML = "";
  document.getElementById("generatePdfBtn").disabled = true;
  document.getElementById("previewSection").style.display = "none";
  document.getElementById("generationInfo").style.display = "none";
  document.getElementById("statusMessages").innerHTML = "";

  showStatus(
    "All data cleared. Ready to generate new location barcodes.",
    "info"
  );
}

// Add input validation
document.getElementById("barcodeCount").addEventListener("input", function () {
  const value = parseInt(this.value);
  if (value > 1000) {
    this.value = 1000;
    showStatus("Maximum 1000 barcodes allowed", "warning");
  }
});

document.getElementById("barcodePrefix").addEventListener("input", function () {
  if (this.value.length > 10) {
    this.value = this.value.substring(0, 10);
    showStatus("Maximum 10 characters allowed for prefix", "warning");
  }
});
