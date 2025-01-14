import { Page } from "react-pdf";
import { forwardRef } from "react";
import { VirtualItem } from "@tanstack/react-virtual";

interface PDFPageRendererProps {
  pageNumber: number;
  scale: number;
  virtualItem: VirtualItem;
}

export const PDFPageRenderer = forwardRef<HTMLDivElement, PDFPageRendererProps>(
  ({ pageNumber, scale, virtualItem }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
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
  }
);

PDFPageRenderer.displayName = "PDFPageRenderer";