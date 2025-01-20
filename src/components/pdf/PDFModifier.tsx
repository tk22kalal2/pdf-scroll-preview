import { PDFDocument, rgb } from 'pdf-lib';

interface PDFModifierProps {
  file: File;
  currentPage: number;
  overlays: Array<{ top: number; left: number; width: number; height: number }>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const modifyPDF = async ({
  file,
  currentPage,
  overlays,
  containerRef
}: PDFModifierProps): Promise<Uint8Array> => {
  const existingPdfBytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();

  for (const overlay of overlays) {
    const pageIndex = currentPage - 1;
    if (pageIndex < pages.length) {
      const page = pages[pageIndex];
      const { width: pdfWidth, height: pdfHeight } = page.getSize();
      
      const pdfPageElement = containerRef.current?.querySelector('.react-pdf__Page');
      const pageContainer = pdfPageElement?.querySelector('.react-pdf__Page__canvas');
      if (!pdfPageElement || !pageContainer) continue;
      
      const pageRect = pageContainer.getBoundingClientRect();
      
      const relativeLeft = (overlay.left - pageRect.left) / pageRect.width;
      const relativeTop = (overlay.top - pageRect.top) / pageRect.height;
      
      const relativeWidth = overlay.width / pageRect.width;
      const relativeHeight = overlay.height / pageRect.height;
      
      const pdfX = relativeLeft * pdfWidth;
      const pdfY = pdfHeight - (relativeTop * pdfHeight) - (relativeHeight * pdfHeight);
      const scaledWidth = relativeWidth * pdfWidth;
      const scaledHeight = relativeHeight * pdfHeight;

      page.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: scaledWidth,
        height: scaledHeight,
        color: rgb(1, 1, 1),
        opacity: 1,
      });
    }
  }

  return await pdfDoc.save();
};