import PDFDocument from "pdfkit";

// Streams a simple, clean lab report PDF straight to the HTTP response.
// Kept intentionally plain (no logos/letterhead) — labs can layer their own
// branding on top later if needed.
export function streamPatientReport(res, { lab, patient, test, doctorName }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="report-${patient.id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).text(lab.name, { align: "center" });
  if (lab.city) doc.fontSize(10).fillColor("#666").text(lab.city, { align: "center" });
  doc.moveDown(0.5);
  doc.strokeColor("#ccc").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  doc.fillColor("#000").fontSize(14).text("Laboratory Report", { align: "center" });
  doc.moveDown(1);

  const row = (label, value) => {
    doc.fontSize(10).fillColor("#666").text(label, { continued: true, width: 150 });
    doc.fillColor("#000").text(value || "-");
  };

  row("Patient ID:", patient.id);
  row("Patient name:", patient.name);
  row("Age:", patient.age);
  row("Phone:", patient.phone);
  row("Test:", test ? `${test.name} (${test.code})` : patient.test_code);
  row("Referring doctor:", doctorName || "Walk-in / self");
  row("Report date:", new Date().toLocaleDateString("en-IN"));

  doc.moveDown(1);
  doc.strokeColor("#ccc").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  doc.fontSize(12).fillColor("#000").text("Result", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(patient.result && patient.result.trim() ? patient.result : "No result notes were entered for this report.", {
    width: 495,
  });

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#999").text(
    "This report was generated electronically and does not require a signature unless otherwise stated by the lab.",
    { width: 495 }
  );

  doc.end();
}
