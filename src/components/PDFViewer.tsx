import { useState, useEffect, useRef } from "react";
import { Document, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFControls } from "./pdf/PDFControls";
import { PDFPageNavigator } from "./pdf/PDFPageNavigator";
import { PDFPage } from "./pdf/PDFPage";
import { PDFRedactionManager, Redaction } from "./pdf/PDFRedactionManager";
import { PDFRedactionLayer } from "./pdf/PDFRedactionLayer";

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
  const [isRedactMode, setIsRedactMode] = useState(false);
  const [redactions, setRedactions] = useState<Redaction[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());

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
      
      // Update current page based on the first visible item
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
    try {
      const { PDFDocument, rgb } = await import('pdf-lib');
      setIsLoading(true);
      
      if (!file || !file.name) {
        toast.error("Invalid file data");
        setIsLoading(false);
        return;
      }

      if (!navigator.onLine) {
        toast.error("No internet connection. Please check your network.");
        setIsLoading(false);
        return;
      }

      toast.info("Preparing file for download...");
      
      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9-_\.]/g, '_')
        .substring(0, 50);
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Apply redactions
        for (const redaction of redactions) {
          const page = pdfDoc.getPage(redaction.pageNumber - 1);
          page.drawRectangle({
            x: redaction.x,
            y: page.getHeight() - redaction.y - redaction.height,
            width: redaction.width,
            height: redaction.height,
            color: rgb(1, 1, 1), // Using the correct RGB helper function
          });
        }
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = `${safeFileName}_redacted_${Date.now()}.pdf`;
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        toast.success("Download started successfully");
      } catch (error) {
        console.error("Download failed:", error);
        toast.error("Download failed. Please try again.");
      }
    } catch (error) {
      console.error('Error processing PDF:', error);
      toast.error("Error processing PDF. Please try again.");
    } finally {
      setIsLoading(false);
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

  return (
    <div className="relative bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <PDFControls
          isLoading={isLoading}
          numPages={numPages}
          onSplit={handleSplit}
          onDownload={handleDownload}
        />
        <PDFRedactionManager
          isRedactMode={isRedactMode}
          onRedactModeChange={setIsRedactMode}
          redactions={redactions}
        />
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
                  <PDFRedactionLayer
                    pageNumber={pageNumber}
                    isRedactMode={isRedactMode}
                    onRedactionAdd={(redaction) => setRedactions([...redactions, redaction])}
                  />
                  {redactions
                    .filter(r => r.pageNumber === pageNumber)
                    .map((redaction, index) => (
                      <div
                        key={index}
                        className="absolute bg-white border border-gray-200"
                        style={{
                          left: `${redaction.x}px`,
                          top: `${redaction.y}px`,
                          width: `${redaction.width}px`,
                          height: `${redaction.height}px`,
                          pointerEvents: 'none'
                        }}
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