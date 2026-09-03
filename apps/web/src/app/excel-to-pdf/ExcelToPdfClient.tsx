"use client";

import { OfficeToPdfClient } from "@/components/conversion/OfficeToPdfClient";

export function ExcelToPdfClient() {
  return <OfficeToPdfClient config={{
    format: "xlsx",
    accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,.xlsx,.xlsm",
    extensions: ["xlsx", "xlsm"],
    label: "Choose an XLSX or XLSM workbook",
    hint: "XLSX/XLSM displayed values · VBA never runs · legacy XLS is not advertised · maximum 100 MB",
    button: "Convert selected worksheets to PDF",
    maxBytes: 100 * 1024 * 1024,
    defaultOrientation: "landscape",
    sectionSelection: true,
    expectedReport: {
      format: "xlsx",
      preserved: ["displayed cell values", "cached formula values", "basic number/date formats", "font emphasis and colors", "cell fills", "alignment", "multiple worksheets"],
      approximated: ["column widths", "row heights", "merged ranges", "fit-to-width pagination"],
      omitted: ["formula recalculation", "cell border styling", "macro execution", "charts", "worksheet images", "pivot interactions", "legacy XLS"],
      warnings: [],
    },
  }} />;
}
