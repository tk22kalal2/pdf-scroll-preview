import { useState, useEffect } from "react";
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
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    toast.success("PDF loaded successfully");
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrollTop = element.scrollTop;
    const pageHeight = element.scrollHeight / (isSplit ? splitPdfPages.length : numPages);
    const newPage = Math.floor(scrollTop / pageHeight) + 1;
    
    if (isSplit) {
      const splitPageIndex = newPage - 1;
      if (splitPageIndex >= 0 && splitPageIndex < splitPdfPages.length) {
        setCurrentPage(splitPdfPages[splitPageIndex]);
      }
    } else if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
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

  const handleDownload = async () => {
    try {
      const { PDFDocument } = await import('pdf-lib');
      
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
      }
      
      // Save the new PDF
      const newPdfBytes = await newPdfDoc.save();
      
      // Create blob and download
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_${isSplit ? 'split' : 'full'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error("Error downloading PDF");
    }
  };

  return (
    <div className="relative bg-white rounded-lg shadow-lg">
      <div className="flex gap-2 p-4 border-b">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
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
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-2" />
          Download
        </Button>
      </div>
      <div className="max-h-[85vh] overflow-y-auto px-4" onScroll={handleScroll}>
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => toast.error("Error loading PDF")}
          className="flex flex-col items-center"
        >
          {isSplit
            ? splitPdfPages.map((pageNum) => (
                <div key={`page_${pageNum}`} className="mb-8">
                  <Page
                    pageNumber={pageNum}
                    scale={scale}
                    className="shadow-md"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </div>
              ))
            : Array.from(new Array(numPages), (_, index) => (
                <div key={`page_${index + 1}`} className="mb-8">
                  <Page
                    pageNumber={index + 1}
                    scale={scale}
                    className="shadow-md"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </div>
              ))}
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