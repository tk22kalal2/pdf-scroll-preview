import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { Split, Download, Crop } from "lucide-react";
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

interface CropSelection {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
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
  const [isCropping, setIsCropping] = useState(false);
  const [cropSelection, setCropSelection] = useState<CropSelection | null>(null);
  const [startCrop, setStartCrop] = useState<{ x: number; y: number } | null>(null);
  const [croppedPages, setCroppedPages] = useState<{ [key: number]: CropSelection }>({});
  const [previewCrop, setPreviewCrop] = useState(false);
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
    estimateSize: () => 842 * scale, // A4 height in pixels
    overscan: 2,
  });

  useEffect(() => {
    const updateCurrentPage = () => {
      if (!containerRef.current) return;
      
      const scrollTop = containerRef.current.scrollTop;
      const pageHeight = 842 * scale; // A4 height in pixels * scale
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
    pageRefs.current = new Array(numPages).fill(null);
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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
    if (!isCropping) return;
    const pageElement = pageRefs.current[pageNumber - 1];
    if (!pageElement) return;

    const rect = pageElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    setStartCrop({ x, y });
    setCropSelection({
      x,
      y,
      width: 0,
      height: 0,
      pageNumber
    });
    setPreviewCrop(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
    if (!isCropping || !startCrop || !cropSelection) return;
    const pageElement = pageRefs.current[pageNumber - 1];
    if (!pageElement) return;

    const rect = pageElement.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / scale;
    const currentY = (e.clientY - rect.top) / scale;

    setCropSelection({
      x: Math.min(startCrop.x, currentX),
      y: Math.min(startCrop.y, currentY),
      width: Math.abs(currentX - startCrop.x),
      height: Math.abs(currentY - startCrop.y),
      pageNumber
    });
  };

  const handleMouseUp = () => {
    if (!isCropping || !cropSelection) return;
    setCroppedPages(prev => ({
      ...prev,
      [cropSelection.pageNumber]: cropSelection
    }));
    setStartCrop(null);
    setPreviewCrop(true);
    toast.success("Selection completed! The page will be updated with the cropped section.");
  };

  const handleApplyCrop = async (pageNumber: number) => {
    try {
      const { PDFDocument } = await import('pdf-lib');
      const existingPdfBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const cropBox = croppedPages[pageNumber];

      if (cropBox) {
        const page = pages[pageNumber - 1];
        page.setCropBox(
          cropBox.x,
          page.getHeight() - cropBox.y - cropBox.height,
          cropBox.width,
          cropBox.height
        );
      }

      const newPdfBytes = await pdfDoc.save();
      const newFile = new File([newPdfBytes], file.name, { type: 'application/pdf' });
      // Update the file prop with the new cropped PDF
      window.location.reload(); // Temporary solution to refresh the viewer
      toast.success(`Page ${pageNumber} has been cropped successfully`);
    } catch (error) {
      console.error('Error applying crop:', error);
      toast.error("Error applying crop to the page");
    }
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
        
        if (cropSelection && pageNum === cropSelection.pageNumber) {
          copiedPage.setCropBox(
            cropSelection.x,
            copiedPage.getHeight() - cropSelection.y - cropSelection.height,
            cropSelection.width,
            cropSelection.height
          );
        }
        
        newPdfDoc.addPage(copiedPage);
      }
      
      const newPdfBytes = await newPdfDoc.save();
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_${isSplit ? 'split' : 'full'}${cropSelection ? '_cropped' : ''}.pdf`;
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
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsCropping(!isCropping)}
          className={isCropping ? "bg-blue-100" : ""}
        >
          <Crop className="mr-2" />
          {isCropping ? "Cancel Crop" : "Crop"}
        </Button>
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
                  ref={(el) => pageRefs.current[pageNumber - 1] = el}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="flex justify-center mb-8 relative"
                  onMouseDown={(e) => handleMouseDown(e, pageNumber)}
                  onMouseMove={(e) => handleMouseMove(e, pageNumber)}
                  onMouseUp={handleMouseUp}
                >
                  <div className="relative">
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      className="shadow-md"
                      loading={
                        <div className="w-full h-[842px] bg-gray-100 animate-pulse rounded-md" />
                      }
                    />
                    {(cropSelection?.pageNumber === pageNumber || croppedPages[pageNumber]) && (
                      <div
                        className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-30"
                        style={{
                          left: ((previewCrop ? croppedPages[pageNumber]?.x : cropSelection?.x) || 0) * scale,
                          top: ((previewCrop ? croppedPages[pageNumber]?.y : cropSelection?.y) || 0) * scale,
                          width: ((previewCrop ? croppedPages[pageNumber]?.width : cropSelection?.width) || 0) * scale,
                          height: ((previewCrop ? croppedPages[pageNumber]?.height : cropSelection?.height) || 0) * scale,
                        }}
                      />
                    )}
                    {croppedPages[pageNumber] && (
                      <Button
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => handleApplyCrop(pageNumber)}
                      >
                        Apply Crop
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Document>
      </div>
      {numPages > 0 && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm">
          Page {currentPage} of {pages.length}
        </div>
      )}
    </div>
  );
};