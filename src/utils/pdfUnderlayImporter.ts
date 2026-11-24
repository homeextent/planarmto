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
export async function renderBlueprintPage(pdf: BlueprintPdf, pageNumber: number, edge: number, maxChars = 850_000, shouldContinue: () => boolean = () => true) {
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
    const reduced = document.createElement('canvas');
    try {
      // Preserve the requested pixel dimensions first, then downsample in bounded steps.
      for (const ratio of (edge > 1000 ? [1, .9, .8, .7, .6, .5] : [1])) {
        if (!shouldContinue()) throw new Error('Import cancelled.');
        let target = canvas;
        if (ratio !== 1) {
          reduced.width = Math.max(1, Math.floor(canvas.width * ratio));
          reduced.height = Math.max(1, Math.floor(canvas.height * ratio));
          const ctx = reduced.getContext('2d');
          if (!ctx) throw new Error('Canvas unavailable.');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(canvas, 0, 0, reduced.width, reduced.height);
          target = reduced;
        }
        for (const [mime, quality] of [['image/png', 1], ['image/webp', .95], ['image/jpeg', .92], ['image/webp', .85], ['image/jpeg', .85]] as const) {
          if (!shouldContinue()) throw new Error('Import cancelled.');
          const blob = await new Promise<Blob | null>(resolve => target.toBlob(resolve, mime, quality));
          if (!blob || blob.type !== mime || 4 * Math.ceil(blob.size / 3) + 32 > maxChars) continue;
          const src = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Image encoding failed.'));
            reader.readAsDataURL(blob);
          });
          if (src.length <= maxChars) return { src, width: target.width, height: target.height };
        }
      }
      throw new Error('Sheet cannot fit the available image storage budget at a usable resolution. Free project storage or choose a less detailed sheet.');
    } finally { reduced.width = 0; reduced.height = 0; }
  } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
}
