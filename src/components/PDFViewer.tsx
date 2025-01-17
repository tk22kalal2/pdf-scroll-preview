import { useState, useEffect, useRef } from "react";
import { Document, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFControls } from "./pdf/PDFControls";
import { PDFPageNavigator } from "./pdf/PDFPageNavigator";
import { PDFPage } from "./pdf/PDFPage";

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

  // Optimize scale based on device
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
      const { PDFDocument } = await import('pdf-lib');
      setIsLoading(true);
      
      // Validate file
      if (!file || !file.name) {
        toast.error("Invalid file data");
        setIsLoading(false);
        return;
      }

      // Check network connection
      if (!navigator.onLine) {
        toast.error("No internet connection. Please check your network.");
        setIsLoading(false);
        return;
      }

      toast.info("Preparing file for download...");
      
      // Create a safe filename
      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9-_\.]/g, '_')
        .substring(0, 50); // Limit filename length
      
      try {
        // Method 1: Direct Blob download
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        // Create download URL
        const url = window.URL.createObjectURL(blob);
        
        // Create invisible download link
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = `${safeFileName}_${Date.now()}.pdf`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        toast.success("Download started successfully");
      } catch (error) {
        console.error("Primary download method failed:", error);
        
        // Method 2: Fetch API with response blob
        try {
          const response = await fetch(URL.createObjectURL(file));
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `${safeFileName}_${Date.now()}.pdf`;
          link.click();
          
          setTimeout(() => window.URL.revokeObjectURL(url), 100);
          
          toast.success("Download completed using alternative method");
        } catch (fallbackError) {
          console.error("Fallback download method failed:", fallbackError);
          
          // Method 3: Data URL method (most compatible)
          try {
            const reader = new FileReader();
            reader.onload = function() {
              const link = document.createElement('a');
              link.href = reader.result as string;
              link.download = `${safeFileName}_${Date.now()}.pdf`;
              link.click();
            };
            reader.readAsDataURL(file);
            
            toast.success("Download started using compatibility mode");
          } catch (finalError) {
            console.error("All download methods failed:", finalError);
            toast.error("Download failed. Please try again or check your storage permissions.");
          }
        }
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
      <PDFControls
        isLoading={isLoading}
        numPages={numPages}
        onSplit={handleSplit}
        onDownload={handleDownload}
      />
      <div 
        ref={containerRef}
        className="max-h-[85vh] overflow-y-auto px-4"
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
                  className="flex justify-center mb-8"
                >
                  <PDFPage
                    pageNumber={pageNumber}
                    scale={scale}
                    isLoaded={loadedPages.has(pageNumber)}
                  />
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
