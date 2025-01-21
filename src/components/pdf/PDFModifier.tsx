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

      // Get preview overlay coordinates
      const previewCoordinates = {
        topLeft: {
          x: overlay.left,
          y: overlay.top
        },
        topRight: {
          x: overlay.left + overlay.width,
          y: overlay.top
        },
        bottomLeft: {
          x: overlay.left,
          y: overlay.top + overlay.height
        },
        bottomRight: {
          x: overlay.left + overlay.width,
          y: overlay.top + overlay.height
        }
      };

      console.log('Preview Overlay Coordinates:', previewCoordinates);

      // Calculate relative positions (0-1 range)
      const relativePositions = {
        topLeft: {
          x: (previewCoordinates.topLeft.x - pageRect.left) / pageRect.width,
          y: (previewCoordinates.topLeft.y - pageRect.top) / pageRect.height
        },
        topRight: {
          x: (previewCoordinates.topRight.x - pageRect.left) / pageRect.width,
          y: (previewCoordinates.topRight.y - pageRect.top) / pageRect.height
        },
        bottomLeft: {
          x: (previewCoordinates.bottomLeft.x - pageRect.left) / pageRect.width,
          y: (previewCoordinates.bottomLeft.y - pageRect.top) / pageRect.height
        },
        bottomRight: {
          x: (previewCoordinates.bottomRight.x - pageRect.left) / pageRect.width,
          y: (previewCoordinates.bottomRight.y - pageRect.top) / pageRect.height
        }
      };

      console.log('Relative Positions (0-1 range):', relativePositions);

      // Convert to PDF coordinates
      const pdfCoordinates = {
        x: relativePositions.topLeft.x * pdfWidth,
        y: pdfHeight - (relativePositions.topLeft.y * pdfHeight),
        width: (relativePositions.topRight.x - relativePositions.topLeft.x) * pdfWidth,
        height: (relativePositions.bottomLeft.y - relativePositions.topLeft.y) * pdfHeight
      };

      console.log('Final PDF Coordinates:', {
        ...pdfCoordinates,
        corners: {
          topLeft: { x: pdfCoordinates.x, y: pdfCoordinates.y },
          topRight: { x: pdfCoordinates.x + pdfCoordinates.width, y: pdfCoordinates.y },
          bottomLeft: { x: pdfCoordinates.x, y: pdfCoordinates.y - pdfCoordinates.height },
          bottomRight: { x: pdfCoordinates.x + pdfCoordinates.width, y: pdfCoordinates.y - pdfCoordinates.height }
        }
      });

      page.drawRectangle({
        x: pdfCoordinates.x,
        y: pdfCoordinates.y - pdfCoordinates.height, // Adjust Y to account for PDF coordinate system
        width: pdfCoordinates.width,
        height: pdfCoordinates.height,
        color: rgb(1, 1, 1),
        opacity: 1,
      });
    }
  }

  return await pdfDoc.save();
};