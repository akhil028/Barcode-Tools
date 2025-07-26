let barcodeData = [];

// Add event listeners to regenerate barcodes when settings change
[
  "barcodeWidth",
  "barcodeHeight",
  "columns",
  "rows",
  "barcodePrefix",
  "startingNumber",
  "totalLength",
].forEach((id) => {
  document.getElementById(id).addEventListener("input", function () {
    if (barcodeData.length > 0) {
      regenerateBarcodes();
    }
  });
});

function generateBarcodes() {
  const count = document.getElementById("barcodeCount").value;

  if (!count || count <= 0) {
    showStatus("Please enter a valid number of barcodes.", "warning");
    return;
  }
  if (count > 1000) {
    showStatus("Maximum 1000 barcodes allowed at once.", "warning");
    return;
  }

  showStatus("Generating barcodes, please wait...", "info");

  if (createBarcodeData(parseInt(count))) {
    document.getElementById("generatePdfBtn").disabled = false;
    document.getElementById("previewSection").style.display = "block";
    renderBarcodes();
    showStatus(`Successfully generated ${count} pallet barcodes.`, "success");
  }
}

function regenerateBarcodes() {
  const count = barcodeData.length;
  if (createBarcodeData(count)) {
    renderBarcodes();
  }
}

function createBarcodeData(count) {
  const prefix = document.getElementById("barcodePrefix").value.trim();
  const startingNumber = parseInt(
    document.getElementById("startingNumber").value
  );
  const totalLength = parseInt(document.getElementById("totalLength").value);

  if (!prefix) {
    showStatus("Please enter a barcode prefix.", "warning");
    return false;
  }
  if (prefix.length >= totalLength) {
    showStatus("Prefix length must be less than Total Length.", "danger");
    return false;
  }

  barcodeData = Array.from({ length: count }, (_, i) => {
    const number = startingNumber + i;
    const numberStr = number.toString();
    const paddingLength = totalLength - prefix.length;

    return prefix + numberStr.padStart(paddingLength, "0");
  });

  displayGenerationInfo();
  return true;
}

function displayGenerationInfo() {
  const generationInfo = document.getElementById("generationInfo");
  const generationDetails = document.getElementById("generationDetails");

  generationDetails.innerHTML = `
        <div class="row">
          <div class="col-sm-4"><strong>Total Generated:</strong> ${barcodeData.length.toLocaleString()}</div>
          <div class="col-sm-8"><strong>Range:</strong> ${barcodeData[0]} - ${
    barcodeData[barcodeData.length - 1]
  }</div>
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
      bcid: "code128",
      text: data,
      scale: 2,
      height: barcodeHeight,
    });

    // Add descriptive text below the barcode
    const textElement = document.createElement("div");
    textElement.textContent = data;
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

  // Use a timeout to allow the UI to update before blocking for PDF generation
  setTimeout(() => {
    const processCanvases = (index, imageDataArray, callback) => {
      if (index >= barcodeData.length) {
        callback(imageDataArray);
        return;
      }

      const canvas = document.createElement("canvas");
      const barcodeHeight = parseInt(
        document.getElementById("barcodeHeight").value
      );

      bwipjs.toCanvas(
        canvas,
        {
          bcid: "code128",
          text: barcodeData[index],
          scale: 2,
          height: barcodeHeight,
        },
        (err) => {
          if (err) {
            // Handle error if needed
            imageDataArray.push({ imgData: null, details: "" });
          } else {
            const imgData = canvas.toDataURL("image/png", 1.0);
            imageDataArray.push({ imgData, details: barcodeData[index] });
          }
          // Process next canvas in a non-blocking way
          setTimeout(
            () => processCanvases(index + 1, imageDataArray, callback),
            0
          );
        }
      );
    };

    processCanvases(0, [], (imageDataArray) => {
      const doc = new jsPDF();
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm

      const barcodeWidth = parseInt(
        document.getElementById("barcodeWidth").value
      );
      const barcodeHeight = parseInt(
        document.getElementById("barcodeHeight").value
      );
      const columns = parseInt(document.getElementById("columns").value);
      const rows = parseInt(document.getElementById("rows").value);

      const textWidth = 100;
      const textHeight = 15;

      const horizontalMargin =
        (pageWidth - columns * textWidth) / (columns + 1);
      const verticalMargin =
        (pageHeight - rows * (barcodeHeight + textHeight + 5)) / (rows + 1);

      imageDataArray.forEach((data, index) => {
        if (data.imgData) {
          if (index > 0 && index % (columns * rows) === 0) {
            doc.addPage();
          }

          const row = Math.floor((index % (columns * rows)) / columns);
          const col = index % columns;

          const x =
            horizontalMargin +
            col * (textWidth + horizontalMargin) +
            (textWidth - barcodeWidth) / 2;
          const y =
            verticalMargin +
            row * (barcodeHeight + textHeight + 5 + verticalMargin);

          doc.addImage(data.imgData, "PNG", x, y, barcodeWidth, barcodeHeight);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(18);
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

      const prefix = document.getElementById("barcodePrefix").value.trim();
      const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `pallet_${sanitizedPrefix}_barcodes_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      doc.save(fileName);

      document.getElementById("generatePdfBtn").disabled = false;
      document.getElementById("generatePdfBtn").innerHTML =
        '<i class="bi bi-file-earmark-pdf"></i> Generate PDF';

      showStatus(`PDF generated successfully: ${fileName}`, "success");
    });
  }, 100);
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
    "All data cleared. Ready to generate new pallet barcodes.",
    "info"
  );
}
