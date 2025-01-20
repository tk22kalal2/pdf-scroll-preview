import { Document, Page } from "react-pdf";
import { toast } from "sonner";
import { Overlay } from "./Overlay";
import { PDFPage } from "./PDFPage";
import { VirtualItem } from "@tanstack/react-virtual";

interface PDFDocumentViewProps {
  file: File;
  onDocumentLoadSuccess: ({ numPages }: { numPages: number }) => void;
  virtualizer: any;
  pages: number[];
  loadedPages: Set<number>;
  scale: number;
  showOverlay: boolean;
  overlays: Array<{ top: number; left: number; width: number; height: number }>;
  isEditing: boolean;
  onOverlayChange: (index: number, position: { top: number; left: number; width: number; height: number }) => void;
}

export const PDFDocumentView = ({
  file,
  onDocumentLoadSuccess,
  virtualizer,
  pages,
  loadedPages,
  scale,
  showOverlay,
  overlays,
  isEditing,
  onOverlayChange
}: PDFDocumentViewProps) => {
  return (
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
        {virtualizer.getVirtualItems().map((virtualItem: VirtualItem) => {
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
              {(showOverlay || overlays.length > 0) && overlays.map((overlay, index) => (
                <Overlay
                  key={index}
                  {...overlay}
                  isEditing={isEditing}
                  onChange={(position) => onOverlayChange(index, position)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </Document>
  );
};