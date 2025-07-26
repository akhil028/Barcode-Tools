// Define all the available tools with user-friendly names, descriptions, and icons
const tools = [
  {
    file: "./CODE128.html",
    title: "CODE128 Generator",
    desc: "Generate CODE128 barcodes from Excel or CSV data.",
    icon: "bi-upc-scan",
  },
  {
    file: "CODE39.html",
    title: "CODE39 Generator",
    desc: "Create CODE39 barcodes with custom text below.",
    icon: "bi-upc",
  },
  {
    file: "PDF417.html",
    title: "PDF417 Generator",
    desc: "Generate complex PDF417 barcodes for large data sets.",
    icon: "bi-file-earmark-binary",
  },
  {
    file: "QRCode_generator.html",
    title: "QR Code Generator",
    desc: "Create QR codes from a list of text in a file.",
    icon: "bi-qr-code",
  },
  {
    file: "Location_Barcode.html",
    title: "Location Barcode",
    desc: "Generate sequential CODE128 barcodes for locations.",
    icon: "bi-geo-alt-fill",
  },
  {
    file: "Pallet_Barcode.html",
    title: "Pallet Barcode",
    desc: "Create sequential CODE128 barcodes for pallets.",
    icon: "bi-box-seam",
  },
  {
    file: "random_String_Generator.html",
    title: "Random String Generator",
    desc: "Generate random serial numbers and Box IDs.",
    icon: "bi-dice-5-fill",
  },
  {
    file: "Seperate_Excel_File.html",
    title: "Split File Tool",
    desc: "Split a large Excel or CSV file into smaller parts.",
    icon: "bi-file-zip-fill",
  },
  {
    file: "merge_excel_csv.html",
    title: "Merge Files Tool",
    desc: "Merge multiple Excel or CSV files into one.",
    icon: "bi-union",
  },
  {
    file: "deleteDuplicacyFromExcel.html",
    title: "Duplicate Remover",
    desc: "Remove duplicate rows from Excel or CSV files.",
    icon: "bi-journal-x",
  },
  {
    file: "addSOnSerialNumber.html",
    title: "Concatenate Column",
    desc: "Add a prefix or suffix to a column in Excel/CSV.",
    icon: "bi-plus-slash-minus",
  },
];

document.addEventListener("DOMContentLoaded", () => {
  const toolGrid = document.getElementById("toolGrid");

  tools.forEach((tool) => {
    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-4";

    const cardLink = document.createElement("a");
    cardLink.className = "card h-100 tool-card shadow-sm";
    cardLink.href = tool.file;
    cardLink.target = "_blank";
    cardLink.rel = "noopener noreferrer";

    cardLink.innerHTML = `
          <div class="card-body">
            <h5 class="card-title fw-bold">
              <i class="bi ${tool.icon} tool-icon"></i>
              ${tool.title}
            </h5>
            <p class="card-text text-muted">${tool.desc}</p>
          </div>
        `;

    col.appendChild(cardLink);
    toolGrid.appendChild(col);
  });
});
