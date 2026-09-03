"use client";

import { SourceToPdfClient } from "@/components/conversion/SourceToPdfClient";

export function CsvToPdfClient() {
  return <SourceToPdfClient config={{
    format: "csv",
    accept: "text/csv,text/plain,.csv,.tsv",
    uploadLabel: "Choose a CSV or TSV file or drop it here",
    uploadHint: "CSV/TSV · UTF-8 with Windows-1252 fallback · bounded to 10,000 rows",
    editorLabel: "Delimited data",
    placeholder: "Name,Department,Status\nAda,Research,Active",
    initialSource: "Name,Department,Status\nAda Lovelace,Research,Active\nGrace Hopper,Engineering,Active\nKatherine Johnson,Analysis,Archived",
  }} />;
}
