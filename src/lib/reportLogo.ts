import type { jsPDF } from 'jspdf';

/** Draw inside the allotted rectangle without stretching the chosen image. */
export function drawReportLogo(doc: jsPDF, logo: string | null | undefined, x: number, y: number, maxWidth: number, maxHeight: number) {
  if (!logo) return;
  const { width, height } = doc.getImageProperties(logo);
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  doc.addImage(logo, logo.startsWith('data:image/png') ? 'PNG' : 'JPEG', x + (maxWidth - renderedWidth) / 2, y + (maxHeight - renderedHeight) / 2, renderedWidth, renderedHeight);
}