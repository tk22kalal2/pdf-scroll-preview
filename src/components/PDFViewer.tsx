import { useState, useEffect, useRef } from "react";
import { Document, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFControls } from "./pdf/PDFControls";
import { PDFPageNavigator } from "./pdf/PDFPageNavigator";
import { PDFPage } from "./pdf/PDFPage";
import { Button } from "./ui/button";
import { Square } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  file: File;
}

interface Redaction {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
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
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isRedactMode) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPoint({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isRedactMode || !isDrawing || !startPoint) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const width = currentX - startPoint.x;
    const height = currentY - startPoint.y;
    
    const tempRedaction = document.getElementById('temp-redaction');
    if (tempRedaction) {
      tempRedaction.style.width = `${Math.abs(width)}px`;
      tempRedaction.style.height = `${Math.abs(height)}px`;
      tempRedaction.style.left = `${width > 0 ? startPoint.x : currentX}px`;
      tempRedaction.style.top = `${height > 0 ? startPoint.y : currentY}px`;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isRedactMode || !isDrawing || !startPoint) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    const width = Math.abs(endX - startPoint.x);
    const height = Math.abs(endY - startPoint.y);
    const x = Math.min(startPoint.x, endX);
    const y = Math.min(startPoint.y, endY);
    
    if (width > 10 && height > 10) {
      setRedactions([...redactions, {
        pageNumber: currentPage,
        x,
        y,
        width,
        height
      }]);
      toast.success("Redaction area added");
    }
    
    setIsDrawing(false);
    setStartPoint(null);
    
    const tempRedaction = document.getElementById('temp-redaction');
    if (tempRedaction) {
      tempRedaction.style.width = '0';
      tempRedaction.style.height = '0';
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

  return (
    <div className="relative bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <PDFControls
          isLoading={isLoading}
          numPages={numPages}
          onSplit={handleSplit}
          onDownload={handleDownload}
        />
        <Button
          variant={isRedactMode ? "destructive" : "outline"}
          onClick={() => {
            setIsRedactMode(!isRedactMode);
            toast.info(isRedactMode ? "Redact mode disabled" : "Redact mode enabled. Click and drag to cover areas.");
          }}
          className="ml-4"
        >
          <Square className="mr-2" />
          {isRedactMode ? "Exit Redact" : "Redact"}
        </Button>
      </div>
      
      <div 
        ref={containerRef}
        className="max-h-[85vh] overflow-y-auto px-4 relative"
        style={{ height: '85vh' }}
      >
        {isRedactMode && isDrawing && (
          <div
            id="temp-redaction"
            className="absolute bg-white border-2 border-red-500 pointer-events-none"
            style={{ position: 'absolute', zIndex: 1000 }}
          />
        )}
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
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  <PDFPage
                    pageNumber={pageNumber}
                    scale={scale}
                    isLoaded={loadedPages.has(pageNumber)}
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
