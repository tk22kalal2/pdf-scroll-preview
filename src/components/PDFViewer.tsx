import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";
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
    const pageHeight = element.scrollHeight / numPages;
    const newPage = Math.floor(scrollTop / pageHeight) + 1;
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="relative bg-white rounded-lg shadow-lg">
      <div
        className="max-h-[85vh] overflow-y-auto px-4"
        onScroll={handleScroll}
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => toast.error("Error loading PDF")}
          className="flex flex-col items-center"
        >
          {Array.from(new Array(numPages), (_, index) => (
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
          Page {currentPage} of {numPages}
        </div>
      )}
    </div>
  );
};