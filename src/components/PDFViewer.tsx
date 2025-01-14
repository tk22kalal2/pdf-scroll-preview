import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { Split, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFEditor } from "./PDFEditor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  const [startPage, setStartPage] = useState<string>("");
  const [endPage, setEndPage] = useState<string>("");
  const [splitPdfPages, setSplitPdfPages] = useState<number[]>([]);
  const [isSplit, setIsSplit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [annotations, setAnnotations] = useState<any[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);

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

  useEffect(() => {
    const updateCurrentPage = () => {
      if (!containerRef.current) return;
      
      const scrollTop = containerRef.current.scrollTop;
      const pageHeight = 842 * scale;
      const currentPageIndex = Math.floor(scrollTop / pageHeight);
      const newPage = pages[currentPageIndex] || 1;
      
      setCurrentPage(newPage);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', updateCurrentPage);
      return () => container.removeEventListener('scroll', updateCurrentPage);
    }
  }, [scale, pages]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    toast.success("PDF loaded successfully");
  };

  const handleSplit = () => {
    const start = parseInt(startPage);
    const end = parseInt(endPage);

    if (isNaN(start) || isNaN(end)) {
      toast.error("Please enter valid page numbers");
      return;
    }

    if (start < 1 || end > numPages || start > end) {
      toast.error(`Please enter page numbers between 1 and ${numPages}`);
      return;
    }

    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    setSplitPdfPages(pages);
    setIsSplit(true);
    setCurrentPage(start);
    toast.success(`PDF split from page ${start} to ${end}`);
  };

  const handleAnnotationsChange = (newAnnotations: any[]) => {
    setAnnotations((prev) => [...prev, ...newAnnotations]);
  };

  const handleDownload = async () => {
    try {
      const { PDFDocument } = await import('pdf-lib');
      setIsLoading(true);
      
      // Load the PDF
      const existingPdfBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      
      // Create a new PDF document
      const newPdfDoc = await PDFDocument.create();
      
      // Copy pages to new document
      const pagesToCopy = isSplit ? splitPdfPages : Array.from({ length: numPages }, (_, i) => i + 1);
      
      for (const pageNum of pagesToCopy) {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
        newPdfDoc.addPage(copiedPage);
        
        // Add annotations if they exist for this page
        const pageAnnotations = annotations.filter(a => a.pageNumber === pageNum);
        if (pageAnnotations.length > 0) {
          // Apply annotations to the page
          // Note: This is a simplified version. In a real implementation,
          // you would need to convert the annotations to PDF annotations
          // using pdf-lib's annotation features
        }
      }
      
      // Save the new PDF
      const newPdfBytes = await newPdfDoc.save();
      
      // Create blob and download
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

  return (
    <div className="relative bg-white rounded-lg shadow-lg">
      <div className="flex gap-2 p-4 border-b">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isLoading}>
              <Split className="mr-2" />
              Split PDF
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Split PDF</DialogTitle>
              <DialogDescription>
                Enter the range of pages you want to split from the PDF.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  placeholder="Start page"
                  value={startPage}
                  onChange={(e) => setStartPage(e.target.value)}
                  min={1}
                  max={numPages}
                />
                <span>to</span>
                <Input
                  type="number"
                  placeholder="End page"
                  value={endPage}
                  onChange={(e) => setEndPage(e.target.value)}
                  min={1}
                  max={numPages}
                />
              </div>
              <Button onClick={handleSplit}>Split</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={isLoading}>
          <Download className="mr-2" />
          Download
        </Button>
      </div>
      <PDFEditor pageRef={pageRefs.current[currentPage - 1]} onAnnotationsChange={handleAnnotationsChange} />
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
                  ref={(el) => {
                    if (el) {
                      pageRefs.current[pageNumber - 1] = el;
                    }
                  }}
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
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    className="shadow-md"
                    loading={
                      <div className="w-full h-[842px] bg-gray-100 animate-pulse rounded-md" />
                    }
                  />
                </div>
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