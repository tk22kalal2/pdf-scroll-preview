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
      
      console.log('PDF Page Dimensions:', {
        width: pdfWidth,
        height: pdfHeight
      });
      
      const pdfPageElement = containerRef.current?.querySelector('.react-pdf__Page');
      const pageContainer = pdfPageElement?.querySelector('.react-pdf__Page__canvas');
      if (!pdfPageElement || !pageContainer) continue;
      
      const pageRect = pageContainer.getBoundingClientRect();
      console.log('Preview Page Dimensions:', {
        width: pageRect.width,
        height: pageRect.height
      });

      // Log original overlay coordinates
      console.log('Original Overlay Coordinates:', {
        top: overlay.top,
        right: overlay.left + overlay.width,
        bottom: overlay.top + overlay.height,
        left: overlay.left,
        width: overlay.width,
        height: overlay.height
      });

      // Calculate relative positions
      const relativeLeft = (overlay.left - pageRect.left) / pageRect.width;
      const relativeTop = (overlay.top - pageRect.top) / pageRect.height;
      const relativeWidth = overlay.width / pageRect.width;
      const relativeHeight = overlay.height / pageRect.height;

      // Log relative positions (0-1 range)
      console.log('Relative Positions (0-1 range):', {
        left: relativeLeft,
        top: relativeTop,
        width: relativeWidth,
        height: relativeHeight
      });

      // Convert to PDF coordinates
      const pdfX = relativeLeft * pdfWidth;
      const pdfY = pdfHeight - ((relativeTop + relativeHeight) * pdfHeight);

      // Log final PDF coordinates
      console.log('Final PDF Coordinates:', {
        x: pdfX,
        y: pdfY,
        width: relativeWidth * pdfWidth,
        height: relativeHeight * pdfHeight,
        corners: {
          topLeft: { x: pdfX, y: pdfY + (relativeHeight * pdfHeight) },
          topRight: { x: pdfX + (relativeWidth * pdfWidth), y: pdfY + (relativeHeight * pdfHeight) },
          bottomLeft: { x: pdfX, y: pdfY },
          bottomRight: { x: pdfX + (relativeWidth * pdfWidth), y: pdfY }
        }
      });

      page.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: relativeWidth * pdfWidth,
        height: relativeHeight * pdfHeight,
        color: rgb(1, 1, 1),
        opacity: 1,
      });
    }
  }

  return await pdfDoc.save();
};