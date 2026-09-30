/** Genera un PDF (WinAnsi) de reporte para enviar a cobro. */
const InvoicePDF = {
  build(invoice) {
    const pageW = 612;
    const pageH = 792;
    const margin = 48;
    const lines = [];
    const pages = [];
    let y = 0;

    const flushPage = () => {
      lines.push("BT");
      lines.push("/F1 8 Tf");
      lines.push(`${margin.toFixed(1)} 24 Td`);
      lines.push(`${pdfString("Esta app fue creada por Eliezer Cruz")} Tj`);
      lines.push("ET");
      pages.push(lines.splice(0, lines.length).join("\n"));
    };

    const ensure = (h) => {
      if (y - h < 56) {
        flushPage();
        y = pageH - 56;
        text(margin, y, 9, false, "Reporte (cont.)");
        y -= 28;
      }
    };

    const text = (x, yy, size, bold, str) => {
      lines.push("BT");
      lines.push(`${bold ? "/F2" : "/F1"} ${size} Tf`);
      lines.push(`${x.toFixed(1)} ${yy.toFixed(1)} Td`);
      lines.push(`${pdfString(str)} Tj`);
      lines.push("ET");
    };

    const rule = (x, yy, w) => {
      lines.push(`${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} 0.6 re`);
      lines.push("f");
    };

    const headerBar = () => {
      lines.push("0.07 0.16 0.22 rg");
      lines.push(`0 ${pageH - 108} ${pageW} 108 re f`);
      lines.push("1 1 1 rg");
      text(margin, pageH - 48, 22, true, "REPORTE");
      text(margin, pageH - 78, 11, false, invoice.issued);
      lines.push("0 0 0 rg");
    };

    y = pageH - 132;
    headerBar();

    text(margin, y, 9, true, "DE");
    y -= 14;
    text(margin, y, 11, false, invoice.fromName || "Servicios audiovisuales freelance");
    y -= 13;
    if (invoice.fromPhone) {
      text(margin, y, 10, false, invoice.fromPhone);
      y -= 13;
    }
    y -= 6;
    text(margin, y, 9, true, "PARA");
    y -= 14;
    text(margin, y, 12, true, invoice.companyName);
    y -= 16;
    text(margin, y, 10, false, `Periodo: ${invoice.period}`);
    y -= 22;

    lines.push("0.07 0.16 0.22 rg");
    lines.push(`${margin} ${y - 6} ${pageW - margin * 2} 22 re f`);
    lines.push("1 1 1 rg");
    text(margin + 8, y, 10, true, "Fecha");
    text(margin + 118, y, 10, true, "Dias");
    text(margin + 168, y, 10, true, "Trabajo");
    text(pageW - margin - 52, y, 10, true, "Monto");
    lines.push("0 0 0 rg");
    y -= 26;

    invoice.jobs.forEach((job, index) => {
      ensure(20);
      if (index % 2 === 0) {
        lines.push("0.96 0.96 0.96 rg");
        lines.push(`${margin} ${y - 4} ${pageW - margin * 2} 18 re f`);
        lines.push("0 0 0 rg");
      }
      text(margin + 8, y, 10, false, job.date);
      text(margin + 118, y, 10, false, String(job.daysLabel || job.days || ""));
      text(margin + 168, y, 10, false, clip(job.project, 36));
      text(pageW - margin - 70, y, 10, true, job.amount);
      y -= 18;
    });

    y -= 8;
    ensure(70);
    rule(margin, y, pageW - margin * 2);
    y -= 20;
    text(margin, y, 12, true, "TOTAL");
    text(pageW - margin - 90, y, 12, true, invoice.total);
    y -= 16;
    if (invoice.totalDaysLabel) {
      text(margin, y, 10, false, `Total dias: ${invoice.totalDaysLabel}`);
      y -= 16;
    }
    y -= 28;
    if (invoice.paymentNote) {
      ensure(40);
      text(margin, y, 9, true, "Instrucciones de pago");
      y -= 14;
      wrap(invoice.paymentNote, 78).forEach((row) => {
        ensure(14);
        text(margin, y, 10, false, row);
        y -= 13;
      });
      y -= 8;
    }
    ensure(36);
    text(margin, y, 9, false, "Documento generado para cobro de servicios audiovisuales.");
    y -= 14;
    text(margin, y, 8, false, "Esta app fue creada por Eliezer Cruz");

    flushPage();

    const objects = [];
    const add = (body) => {
      objects.push(body);
      return objects.length;
    };

    const font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const contentIds = pages.map((stream) =>
      add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    );
    const pageIds = contentIds.map((contentId) =>
      add(
        `<< /Type /Page /Parent PAGES /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> >>`
      )
    );
    const pagesId = add(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
    );
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    const infoId = add(`<< /Title ${pdfString("Reporte")} >>`);

    const bodies = objects.map((body) => body.replace("PAGES", `${pagesId} 0 R`));
    let offset = 0;
    const chunks = ["%PDF-1.4\n"];
    offset = chunks[0].length;
    const xref = [0];
    bodies.forEach((body, i) => {
      xref.push(offset);
      const obj = `${i + 1} 0 obj\n${body}\nendobj\n`;
      chunks.push(obj);
      offset += obj.length;
    });
    const xrefStart = offset;
    let xrefTable = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
    xref.slice(1).forEach((pos) => {
      xrefTable += `${String(pos).padStart(10, "0")} 00000 n \n`;
    });
    chunks.push(xrefTable);
    chunks.push(
      `trailer\n<< /Size ${bodies.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
    );
    return new Blob(chunks, { type: "application/pdf" });
  },
};

function clip(text, max) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function wrap(text, width) {
  const words = String(text || "").split(/\s+/);
  const rows = [];
  let row = "";
  words.forEach((word) => {
    const next = row ? `${row} ${word}` : word;
    if (next.length > width) {
      if (row) rows.push(row);
      row = word;
    } else {
      row = next;
    }
  });
  if (row) rows.push(row);
  return rows;
}

function pdfString(text) {
  const map = {
    "\u00E1": "\\341",
    "\u00E9": "\\351",
    "\u00ED": "\\355",
    "\u00F3": "\\363",
    "\u00FA": "\\372",
    "\u00F1": "\\361",
    "\u00FC": "\\374",
    "\u00C1": "\\301",
    "\u00C9": "\\311",
    "\u00CD": "\\315",
    "\u00D3": "\\323",
    "\u00DA": "\\332",
    "\u00D1": "\\321",
    "\u00BF": "\\277",
    "\u00A1": "\\241",
    "\u00B0": "\\260",
    "\u2014": "-",
    "\u2013": "-",
    "\u201C": "\"",
    "\u201D": "\"",
    "\u2019": "'",
    "\u2026": "...",
  };
  let out = "";
  for (const ch of String(text ?? "")) {
    if (map[ch]) out += map[ch];
    else if (ch === "\\" || ch === "(" || ch === ")") out += `\\${ch}`;
    else if (ch.charCodeAt(0) > 127) out += "?";
    else out += ch;
  }
  return `(${out})`;
}
