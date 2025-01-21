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

      // Normalize coordinates to ensure they're within page bounds
      const normalizedCoordinates = {
        left: Math.max(0, overlay.left),
        top: Math.max(0, overlay.top),
        width: overlay.width,
        height: overlay.height
      };

      // Calculate scale factors
      const scaleX = pdfWidth / pageRect.width;
      const scaleY = pdfHeight / pageRect.height;

      // Convert preview coordinates to PDF coordinates
      const pdfCoordinates = {
        x: normalizedCoordinates.left * scaleX,
        y: pdfHeight - ((normalizedCoordinates.top * scaleY) + (normalizedCoordinates.height * scaleY)),
        width: normalizedCoordinates.width * scaleX,
        height: normalizedCoordinates.height * scaleY
      };

      console.log('Normalized Preview Coordinates:', normalizedCoordinates);
      console.log('Scale Factors:', { scaleX, scaleY });
      console.log('Final PDF Coordinates:', {
        ...pdfCoordinates,
        corners: {
          topLeft: { x: pdfCoordinates.x, y: pdfCoordinates.y + pdfCoordinates.height },
          topRight: { x: pdfCoordinates.x + pdfCoordinates.width, y: pdfCoordinates.y + pdfCoordinates.height },
          bottomLeft: { x: pdfCoordinates.x, y: pdfCoordinates.y },
          bottomRight: { x: pdfCoordinates.x + pdfCoordinates.width, y: pdfCoordinates.y }
        }
      });

      page.drawRectangle({
        x: pdfCoordinates.x,
        y: pdfCoordinates.y,
        width: pdfCoordinates.width,
        height: pdfCoordinates.height,
        color: rgb(1, 1, 1),
        opacity: 1,
      });
    }
  }

  return await pdfDoc.save();
};