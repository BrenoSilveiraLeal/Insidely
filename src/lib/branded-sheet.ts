import ExcelJS from "exceljs";

// Spreadsheets people download (earnings, "Baixar meus dados") in the Insidely look: a navy band
// with the brand and the title, a coral rule, the generation date, a frozen header row with filters,
// money in R$ and an optional totals row. One worksheet per section.

const INK = "FF172033";
const CORAL = "FFFF7657";
const PAPER = "FFF7F2E8";
const PAPER_2 = "FFEAE3D6";
const MUTED = "FF6B7280";

export type SheetColumn = { header: string; key: string; width?: number; type?: "text" | "money" | "date" | "number" };
export type SheetSection = { name: string; columns: SheetColumn[]; rows: Record<string, unknown>[]; totals?: Record<string, number | string>; empty?: string };

export async function buildBrandedWorkbook({ title, subtitle, sections }: { title: string; subtitle?: string; sections: SheetSection[] }) {
  const book = new ExcelJS.Workbook();
  book.creator = "Insidely";
  book.created = new Date();
  const generated = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
  for (const section of sections) {
    const sheet = book.addWorksheet(section.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 6, showGridLines: false }], properties: { tabColor: { argb: CORAL } } });
    const span = Math.max(section.columns.length, 3);
    sheet.columns = section.columns.map((column) => ({ key: column.key, width: column.width ?? (column.type === "money" ? 16 : column.type === "date" ? 20 : 24) }));
    const band = (row: number, text: string, font: Partial<ExcelJS.Font>, height: number, fill = INK) => {
      sheet.mergeCells(row, 1, row, span);
      const cell = sheet.getCell(row, 1);
      cell.value = text;
      cell.font = { name: "Calibri", ...font };
      cell.alignment = { vertical: "middle", indent: 1 };
      for (let col = 1; col <= span; col++) sheet.getCell(row, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      sheet.getRow(row).height = height;
    };
    band(1, "INSIDELY", { size: 11, bold: true, color: { argb: CORAL } }, 22);
    band(2, `${title} · ${section.name}`, { size: 18, bold: true, color: { argb: "FFFFFFFF" } }, 32);
    band(3, subtitle ? `${subtitle} · gerado em ${generated}` : `Gerado em ${generated}`, { size: 10, color: { argb: "FFD8DCE5" } }, 20);
    band(4, "", {}, 4, CORAL);
    sheet.getRow(5).height = 8;
    const header = sheet.getRow(6);
    section.columns.forEach((column, index) => {
      const cell = header.getCell(index + 1);
      cell.value = column.header;
      cell.font = { name: "Calibri", bold: true, color: { argb: INK }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPER_2 } };
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: column.type === "money" || column.type === "number" ? "right" : "left" };
      cell.border = { bottom: { style: "medium", color: { argb: INK } } };
    });
    header.height = 26;
    if (!section.rows.length) {
      sheet.mergeCells(7, 1, 7, span);
      const cell = sheet.getCell(7, 1);
      cell.value = section.empty ?? "Nada registrado.";
      cell.font = { italic: true, color: { argb: MUTED } };
      cell.alignment = { indent: 1 };
      continue;
    }
    section.rows.forEach((values, index) => {
      const row = sheet.getRow(7 + index);
      section.columns.forEach((column, col) => {
        const cell = row.getCell(col + 1);
        const value = values[column.key];
        cell.value = value === null || value === undefined ? "" : column.type === "money" ? Number(value) / 100 : column.type === "date" && typeof value === "string" ? new Date(value) : typeof value === "object" && !(value instanceof Date) ? JSON.stringify(value) : value as ExcelJS.CellValue;
        if (column.type === "money") cell.numFmt = '"R$" #,##0.00';
        if (column.type === "date") cell.numFmt = "dd/mm/yyyy hh:mm";
        cell.alignment = { vertical: "top", wrapText: column.type === "text" || !column.type };
        if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPER } };
        cell.border = { bottom: { style: "hair", color: { argb: PAPER_2 } } };
      });
    });
    sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6 + section.rows.length, column: section.columns.length } };
    if (section.totals) {
      const row = sheet.getRow(7 + section.rows.length);
      section.columns.forEach((column, col) => {
        const cell = row.getCell(col + 1);
        const value = section.totals?.[column.key];
        cell.value = value === undefined ? "" : column.type === "money" && typeof value === "number" ? value / 100 : value;
        if (column.type === "money") cell.numFmt = '"R$" #,##0.00';
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
      });
      row.height = 22;
    }
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

export function xlsxResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}
