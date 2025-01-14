import { useState, useEffect, useRef, useCallback } from "react";
import { Document, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PDFToolbar } from "./pdf/PDFToolbar";
import { PDFPageRenderer } from "./pdf/PDFPageRenderer";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  file: File;
}

export const PDFViewer = ({ file }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState(1);
  const [isSplit, setIsSplit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [splitPdfPages, setSplitPdfPages] = useState<number[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    overscan: 2,
  });

  const handleSplit = useCallback((start: number, end: number) => {
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    setSplitPdfPages(pages);
    setIsSplit(true);
    setCurrentPage(start);
    toast.success(`PDF split from page ${start} to ${end}`);
  }, []);

  const handleDownload = async () => {
    try {
      const { PDFDocument } = await import('pdf-lib');
      setIsLoading(true);
      
      const existingPdfBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const newPdfDoc = await PDFDocument.create();
      
      const pagesToCopy = isSplit ? splitPdfPages : Array.from({ length: numPages }, (_, i) => i + 1);
      
      for (const pageNum of pagesToCopy) {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
        newPdfDoc.addPage(copiedPage);
      }
      
      const newPdfBytes = await newPdfDoc.save();
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_edited.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setIsLoading(false);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setIsLoading(false);
      toast.error("Error downloading PDF");
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    toast.success("PDF loaded successfully");
  };

  const handleAnnotationsChange = (newAnnotations: any[]) => {
    setAnnotations((prev) => [...prev, ...newAnnotations]);
  };

  return (
    <div className="relative bg-white rounded-lg shadow-lg">
      <PDFToolbar
        isLoading={isLoading}
        numPages={numPages}
        onSplit={handleSplit}
        onDownload={handleDownload}
        pageRef={pageRefs.current[currentPage - 1]}
        onAnnotationsChange={handleAnnotationsChange}
      />
      <div
        ref={containerRef}
        className="max-h-[85vh] overflow-y-auto px-4"
        style={{ height: "85vh" }}
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
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const pageNumber = pages[virtualItem.index];
              return (
                <PDFPageRenderer
                  key={virtualItem.key}
                  ref={(el) => {
                    pageRefs.current[pageNumber - 1] = el;
                  }}
                  pageNumber={pageNumber}
                  scale={scale}
                  virtualItem={virtualItem}
                />
              );
            })}
          </div>
        </Document>
      </div>
      {numPages > 0 && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm">
          Page {currentPage} of {isSplit ? splitPdfPages.length : numPages}
        </div>
      )}
    </div>
  );
};