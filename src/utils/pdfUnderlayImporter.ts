// PDF processing is independent of the active CAD workspace.
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;
export const MAX_PDF_BYTES = 80 * 1024 * 1024;
export async function openBlueprintPdf(file: File) {
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF exceeds the 80 MB import limit.');
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try { return await task.promise; } catch (error) { await task.destroy(); throw error; }
}
export type BlueprintPdf = Awaited<ReturnType<typeof openBlueprintPdf>>;
export async function renderBlueprintPage(pdf: BlueprintPdf, pageNumber: number, edge: number, maxChars = 700_000) {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(edge / Math.max(base.width, base.height), Math.sqrt(24_000_000 / (base.width * base.height)));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable.');
  try {
    await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
    for (const [mime, quality] of [['image/png', 1], ['image/webp', .95], ['image/jpeg', .92], ['image/jpeg', .85]] as const) {
      const src = canvas.toDataURL(mime, quality);
      if (src !== 'data:,' && src.length <= maxChars) return { src, width: canvas.width, height: canvas.height };
    }
    throw new Error('Sheet exceeds the image storage budget. Select a lower resolution.');
  } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
}
