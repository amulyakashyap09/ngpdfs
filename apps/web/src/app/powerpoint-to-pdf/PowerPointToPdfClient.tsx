"use client";

import { OfficeToPdfClient } from "@/components/conversion/OfficeToPdfClient";

export function PowerPointToPdfClient() {
  return <OfficeToPdfClient config={{
    format: "pptx",
    accept: "application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx",
    extensions: ["pptx"],
    label: "Choose a PPTX presentation",
    hint: "PPTX · source slide dimensions retained · macros never run · maximum 120 MB",
    button: "Convert presentation to PDF",
    maxBytes: 120 * 1024 * 1024,
    defaultOrientation: "landscape",
    preserveSourcePageSize: true,
    expectedReport: {
      format: "pptx",
      preserved: ["slide dimensions", "slide order", "background colors", "positioned text boxes", "basic shapes", "line styles", "PNG/JPEG images", "theme colors", "z-order"],
      approximated: ["gradient fills", "source fonts", "mixed text-run styling", "group transforms", "text autofit"],
      omitted: ["master/layout-only objects", "shape rotation and shadows", "animations", "transitions", "speaker notes", "charts", "SmartArt", "embedded objects", "macros"],
      warnings: [],
    },
  }} />;
}
