import { useState, useEffect, useRef } from "react";
import { pdfjs } from "react-pdf";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFControls } from "./pdf/PDFControls";
import { PDFPageNavigator } from "./pdf/PDFPageNavigator";
import { PDFOverlayEditor } from "./pdf/PDFOverlayEditor";
import { PDFDocumentView } from "./pdf/PDFDocumentView";
import { modifyPDF } from "./pdf/PDFModifier";

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
  const [modifiedPdfBytes, setModifiedPdfBytes] = useState<Uint8Array | null>(null);

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
      
      setLoadedPages(visibleIndexes);
    }
  });

  const handleDownload = async () => {
    if (!file || !file.name) {
      toast.error("Invalid file data");
      return;
    }

    try {
      let downloadData: Blob;
      if (modifiedPdfBytes) {
        downloadData = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      } else {
        downloadData = file;
      }

      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9-_\.]/g, '_')
        .substring(0, 50);
      
      const url = URL.createObjectURL(downloadData);
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
      const modifiedBytes = await modifyPDF({
        file,
        currentPage,
        overlays,
        containerRef
      });
      
      setModifiedPdfBytes(modifiedBytes);
      toast.success("Changes applied successfully. Click Download to save the PDF.");
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
        <PDFOverlayEditor
          showOverlay={showOverlay}
          overlays={overlays}
          isEditing={isEditing}
          onAddOverlay={handleAddOverlay}
          onApplyChanges={handleApplyChanges}
          onOverlayChange={handleOverlayChange}
        />
      </div>
      
      <div 
        ref={containerRef}
        className="max-h-[85vh] overflow-y-auto px-4 relative"
        style={{ height: '85vh' }}
      >
        <PDFDocumentView
          file={file}
          onDocumentLoadSuccess={onDocumentLoadSuccess}
          virtualizer={virtualizer}
          pages={pages}
          loadedPages={loadedPages}
          scale={scale}
          showOverlay={showOverlay}
          overlays={overlays}
          isEditing={isEditing}
          onOverlayChange={handleOverlayChange}
        />
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