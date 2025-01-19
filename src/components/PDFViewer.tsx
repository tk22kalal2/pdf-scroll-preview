import { useState, useEffect, useRef } from "react";
import { Document, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PDFDocument, rgb } from 'pdf-lib';
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFControls } from "./pdf/PDFControls";
import { PDFPageNavigator } from "./pdf/PDFPageNavigator";
import { PDFPage } from "./pdf/PDFPage";
import { Button } from "./ui/button";
import { Overlay } from "./pdf/Overlay";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  file: File;
}

export const PDFViewer = ({ file }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState(1);
  const [splitPdfPages, setSplitPdfPages] = useState<number[]>([]);
  const [isSplit, setIsSplit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlays, setOverlays] = useState<Array<{ top: number; left: number; width: number; height: number }>>([]);
  const [isEditing, setIsEditing] = useState(true);

  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      if (width < 640) setScale(0.6);
      else if (width < 768) setScale(0.8);
      else setScale(1);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const pages = isSplit ? splitPdfPages : Array.from({ length: numPages }, (_, i) => i + 1);

  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 842 * scale,
    overscan: 1,
    onChange: (instance) => {
      const visibleRange = instance.getVirtualItems();
      const visibleIndexes = new Set(visibleRange.map(item => pages[item.index]));
      
      if (visibleRange.length > 0) {
        const firstVisibleIndex = visibleRange[0].index;
        const currentPageNumber = pages[firstVisibleIndex];
        setCurrentPage(currentPageNumber);
      }
      
      for (let i = -2; i <= 2; i++) {
        const firstVisible = visibleRange[0]?.index ?? 0;
        const lastVisible = visibleRange[visibleRange.length - 1]?.index ?? 0;
        const bufferIndex = firstVisible + i;
        const bufferIndex2 = lastVisible + i;
        
        if (bufferIndex >= 0 && bufferIndex < pages.length) {
          visibleIndexes.add(pages[bufferIndex]);
        }
        if (bufferIndex2 >= 0 && bufferIndex2 < pages.length) {
          visibleIndexes.add(pages[bufferIndex2]);
        }
      }

      setLoadedPages(visibleIndexes);
    }
  });

  const handleDownload = async () => {
    if (!file || !file.name) {
      toast.error("Invalid file data");
      return;
    }

    const safeFileName = file.name
      .replace(/[^a-zA-Z0-9-_\.]/g, '_')
      .substring(0, 50);
    
    try {
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFileName}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Download started successfully");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed. Please try again.");
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    toast.success("PDF loaded successfully");
  };

  const handleSplit = (start: number, end: number) => {
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    setSplitPdfPages(pages);
    setIsSplit(true);
    setCurrentPage(start);
    toast.success(`PDF split from page ${start} to ${end}`);
  };

  const handleJumpToPage = (pageNum: number) => {
    const targetPage = isSplit ? splitPdfPages[pageNum - 1] : pageNum;
    const pageHeight = 842 * scale;
    const scrollPosition = (targetPage - 1) * pageHeight;
    
    containerRef.current?.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });

    setCurrentPage(targetPage);
  };

  const handleAddOverlay = () => {
    setShowOverlay(true);
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      const newOverlay = {
        top: (containerRect.height / 2) - 100,
        left: (containerRect.width / 2) - 100,
        width: 200,
        height: 200
      };
      setOverlays(prev => [...prev, newOverlay]);
    }
  };

  const handleOverlayChange = (index: number, position: { top: number; left: number; width: number; height: number }) => {
    setOverlays(prev => {
      const newOverlays = [...prev];
      newOverlays[index] = position;
      return newOverlays;
    });
  };

  const handleApplyChanges = async () => {
    setIsEditing(false);
    setShowOverlay(false);
    toast.success("Processing PDF...");
    
    try {
      const existingPdfBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      // For each overlay, add a white rectangle to the corresponding page
      for (const overlay of overlays) {
        const pageIndex = currentPage - 1;
        if (pageIndex < pages.length) {
          const page = pages[pageIndex];
          const { width: pdfWidth, height: pdfHeight } = page.getSize();
          
          // Get the container dimensions
          const containerRect = containerRef.current!.getBoundingClientRect();
          const containerWidth = containerRect.width;
          const containerHeight = containerRect.height;
          
          // Calculate scale factors
          const scaleX = pdfWidth / containerWidth;
          const scaleY = pdfHeight / containerHeight;
          
          // Convert screen coordinates to PDF coordinates
          const pdfX = overlay.left * scaleX;
          // In PDF coordinates, Y=0 is at the bottom, so we need to flip it
          const pdfY = pdfHeight - ((overlay.top + overlay.height) * scaleY);
          const scaledWidth = overlay.width * scaleX;
          const scaledHeight = overlay.height * scaleY;

          // Draw white rectangle using rgb helper from pdf-lib
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

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const modifiedPdfBlob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      
      // Download the modified PDF
      const url = URL.createObjectURL(modifiedPdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `processed_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("PDF processed and downloaded successfully");
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast.error("Failed to process PDF. Please try again.");
    }
  };

  return (
    <div className="relative bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <PDFControls
          isLoading={isLoading}
          numPages={numPages}
          onSplit={handleSplit}
          onDownload={handleDownload}
        />
        <div className="flex gap-2">
          <Button onClick={handleAddOverlay} variant="outline">
            Add Overlay
          </Button>
          {showOverlay && overlays.length > 0 && (
            <Button onClick={handleApplyChanges} variant="default">
              Apply Changes
            </Button>
          )}
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="max-h-[85vh] overflow-y-auto px-4 relative"
        style={{ height: '85vh' }}
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => toast.error("Error loading PDF")}
          loading={<div className="text-center py-4">Loading PDF...</div>}
          className="flex flex-col items-center"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const pageNumber = pages[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="flex justify-center mb-8 relative"
                >
                  <PDFPage
                    pageNumber={pageNumber}
                    scale={scale}
                    isLoaded={loadedPages.has(pageNumber)}
                  />
                  {(showOverlay || overlays.length > 0) && overlays.map((overlay, index) => (
                    <Overlay
                      key={index}
                      {...overlay}
                      isEditing={isEditing}
                      onChange={(position) => handleOverlayChange(index, position)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </Document>
      </div>
      {numPages > 0 && (
        <PDFPageNavigator
          currentPage={currentPage}
          totalPages={isSplit ? splitPdfPages.length : numPages}
          onJumpToPage={handleJumpToPage}
        />
      )}
    </div>
  );
};