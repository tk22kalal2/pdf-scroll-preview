import { useState, useEffect, useRef } from "react";
import { Document, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFControls } from "./pdf/PDFControls";
import { PDFPageNavigator } from "./pdf/PDFPageNavigator";
import { PDFPage } from "./pdf/PDFPage";
import { PDFNotes } from "./pdf/PDFNotes";
import { NotesEditor } from "./pdf/NotesEditor";
import { performOCR, generateNotesFromText } from "@/utils/pdfUtils";

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
  const [notes, setNotes] = useState("");
  const [ocrText, setOcrText] = useState(""); // Store OCR text for the chatbot
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isProcessingNotes, setIsProcessingNotes] = useState(false);
  const [showingNotes, setShowingNotes] = useState(false);

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
    if (!file || !file.name) {
      toast.error("Invalid file data", { duration: 3000 });
      return;
    }

    const safeFileName = file.name
      .replace(/[^a-zA-Z0-9-_\.]/g, '_')
      .substring(0, 50);
    
    try {
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFileName}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Download started successfully", { duration: 2000 });
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed. Please try again.", { duration: 3000 });
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    toast.success("PDF loaded successfully", { duration: 2000 });
  };

  const handleSplit = (start: number, end: number) => {
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    setSplitPdfPages(pages);
    setIsSplit(true);
    setCurrentPage(start);
    toast.success(`PDF split from page ${start} to ${end}`, { duration: 2000 });
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

  const handleGenerateNotes = async () => {
    if (!isSplit || splitPdfPages.length === 0) {
      toast.error("Please split the PDF first before generating notes", { duration: 3000 });
      return;
    }

    setIsProcessingNotes(true);
    
    // Use dismiss ID to manually dismiss the loading toast when complete
    const loadingToastId = toast.loading("Extracting text from PDF...");

    try {
      // Step 1: Perform OCR on the split PDF pages
      const ocrResult = await performOCR(file, splitPdfPages);
      
      // Save the OCR text for the chatbot
      setOcrText(ocrResult.text);
      
      // Dismiss previous toast and show new one
      toast.dismiss(loadingToastId);
      const processingToastId = toast.loading("Generating detailed notes from extracted text...");

      // Step 2: Send OCR text to Groq API to generate notes
      const notesResult = await generateNotesFromText(ocrResult.text);
      
      // Step 3: Display the generated notes in TinyMCE editor
      setNotes(notesResult.notes);
      setShowingNotes(true);
      
      // Dismiss all loading toasts and show success
      toast.dismiss(processingToastId);
      toast.success("Detailed notes generated successfully", { duration: 2000 });
    } catch (error) {
      console.error("Notes generation error:", error);
      toast.dismiss(loadingToastId);
      toast.error("Failed to generate notes. Please try again.", { duration: 3000 });
    } finally {
      setIsProcessingNotes(false);
    }
  };
  
  const handleReturnToPdf = () => {
    setShowingNotes(false);
  };

  return (
    <div className="relative bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <PDFControls
          isLoading={isLoading || isProcessingNotes}
          numPages={numPages}
          onSplit={handleSplit}
          onDownload={handleDownload}
          onGenerateNotes={handleGenerateNotes}
          isSplit={isSplit}
        />
      </div>
      
      {showingNotes ? (
        <NotesEditor 
          notes={notes} 
          ocrText={ocrText} 
          onReturn={handleReturnToPdf} 
        />
      ) : (
        <>
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
        </>
      )}
      
      {isNotesOpen && (
        <PDFNotes 
          notes={notes} 
          isOpen={isNotesOpen} 
          onClose={() => setIsNotesOpen(false)} 
        />
      )}
    </div>
  );
};
