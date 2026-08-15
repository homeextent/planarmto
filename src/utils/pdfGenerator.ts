import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  fileName?: string;
  onProgress?: (status: string) => void;
}

/**
 * Captures an HTML element and generates a multi-page PDF document,
 * triggering a direct client-side file download.
 */
export async function generatePdfFromElement(
  element: HTMLElement,
  options: PDFExportOptions = {}
): Promise<boolean> {
  const { fileName = 'Architectural_TakeOff_Report.pdf', onProgress } = options;

  try {
    onProgress?.('Preparing document for PDF rasterization...');

    // Temporarily clone or ensure background is solid white for crisp PDF
    const canvas = await html2canvas(element, {
      scale: 1.8, // Crisp Retina resolution
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1040,
    });

    onProgress?.('Formatting PDF pages...');

    // Standard Letter page dimensions in mm
    const pdfPageWidth = 215.9; // 8.5 in
    const pdfPageHeight = 279.4; // 11.0 in
    const margin = 10; // 10mm margins
    const printableWidth = pdfPageWidth - margin * 2;
    const printableHeight = pdfPageHeight - margin * 2;

    const imgWidth = printableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
      compress: true,
    });

    let heightLeft = imgHeight;
    let position = margin;
    let pageNumber = 1;

    // First page
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= printableHeight;

    // Subsequent pages
    while (heightLeft > 0) {
      position = margin - pageNumber * printableHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      pageNumber++;
      heightLeft -= printableHeight;
    }

    onProgress?.('Downloading PDF file...');
    pdf.save(fileName);

    return true;
  } catch (error) {
    console.error('Failed to generate PDF via html2canvas/jsPDF:', error);
    throw error;
  }
}
