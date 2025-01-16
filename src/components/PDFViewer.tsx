import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { Split, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [jumpToPage, setJumpToPage] = useState<string>("");
  const [isJumpDialogOpen, setIsJumpDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > (isSplit ? splitPdfPages.length : numPages)) {
      toast.error(`Please enter a valid page number between 1 and ${isSplit ? splitPdfPages.length : numPages}`);
      return;
    }

    const targetPage = isSplit ? splitPdfPages[pageNum - 1] : pageNum;
    const pageHeight = 842 * scale;
    const scrollPosition = (targetPage - 1) * pageHeight;
    
    containerRef.current?.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });

    setCurrentPage(targetPage);
    setIsJumpDialogOpen(false);
    setJumpToPage("");
    toast.success(`Jumped to page ${pageNum}`);
  };

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
      
      // Enhanced mobile detection
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isWebView = /wv|WebView/.test(navigator.userAgent.toLowerCase());
      
      if (isMobile || isWebView) {
        try {
          // Create a download URL
          const blobUrl = URL.createObjectURL(blob);
          
          // Create an invisible iframe for download
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
          
          // Try direct download first
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${file.name.replace('.pdf', '')}_${isSplit ? 'split' : 'full'}.pdf`;
          link.type = 'application/pdf';
          link.click();
          
          // Cleanup
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            document.body.removeChild(iframe);
          }, 1000);
          
          toast.success("Download started");
        } catch (mobileError) {
          console.error('Mobile PDF download error:', mobileError);
          
          // Fallback: try to trigger download using fetch
          try {
            const response = await fetch(URL.createObjectURL(blob));
            const blobData = await response.blob();
            const blobUrl = URL.createObjectURL(blobData);
            
            window.location.href = blobUrl;
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            
            toast.success("Download started");
          } catch (fetchError) {
            console.error('Fetch fallback error:', fetchError);
            toast.error("Download failed. Please try again.");
          }
        }
      } else {
        // Desktop browser handling
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${file.name.replace('.pdf', '')}_${isSplit ? 'split' : 'full'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("PDF downloaded successfully");
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error handling PDF:', error);
      setIsLoading(false);
      toast.error("Error with PDF. Please try again.");
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
        <>
          <Dialog open={isJumpDialogOpen} onOpenChange={setIsJumpDialogOpen}>
            <DialogTrigger asChild>
              <button className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm hover:bg-gray-700 transition-colors">
                Page {currentPage} of {isSplit ? splitPdfPages.length : numPages}
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Jump to Page</DialogTitle>
                <DialogDescription>
                  Enter the page number you want to jump to.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input
                  type="number"
                  placeholder="Enter page number"
                  value={jumpToPage}
                  onChange={(e) => setJumpToPage(e.target.value)}
                  min={1}
                  max={isSplit ? splitPdfPages.length : numPages}
                />
                <Button onClick={handleJumpToPage}>Jump</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};
