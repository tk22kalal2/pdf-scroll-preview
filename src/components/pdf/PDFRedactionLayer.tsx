import { useState } from "react";
import { toast } from "sonner";

interface Redaction {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PDFRedactionLayerProps {
  pageNumber: number;
  isRedactMode: boolean;
  onRedactionAdd: (redaction: Redaction) => void;
}

export const PDFRedactionLayer = ({ pageNumber, isRedactMode, onRedactionAdd }: PDFRedactionLayerProps) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isRedactMode) return;
    
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const point = e instanceof MouseEvent ? e : e.touches[0];
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPoint({ x, y });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isRedactMode || !isDrawing || !startPoint) return;
    
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const point = e instanceof MouseEvent ? e : e.touches[0];
    const currentX = point.clientX - rect.left;
    const currentY = point.clientY - rect.top;
    
    const width = currentX - startPoint.x;
    const height = currentY - startPoint.y;
    
    const tempRedaction = document.getElementById('temp-redaction');
    if (tempRedaction) {
      tempRedaction.style.width = `${Math.abs(width)}px`;
      tempRedaction.style.height = `${Math.abs(height)}px`;
      tempRedaction.style.left = `${width > 0 ? startPoint.x : currentX}px`;
      tempRedaction.style.top = `${height > 0 ? startPoint.y : currentY}px`;
    }
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isRedactMode || !isDrawing || !startPoint) return;
    
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const point = e instanceof MouseEvent ? e : (e as React.TouchEvent).changedTouches[0];
    const endX = point.clientX - rect.left;
    const endY = point.clientY - rect.top;
    
    const width = Math.abs(endX - startPoint.x);
    const height = Math.abs(endY - startPoint.y);
    const x = Math.min(startPoint.x, endX);
    const y = Math.min(startPoint.y, endY);
    
    if (width > 10 && height > 10) {
      onRedactionAdd({
        pageNumber,
        x,
        y,
        width,
        height
      });
      toast.success("Redaction area added");
    }
    
    setIsDrawing(false);
    setStartPoint(null);
    
    const tempRedaction = document.getElementById('temp-redaction');
    if (tempRedaction) {
      tempRedaction.style.width = '0';
      tempRedaction.style.height = '0';
    }
  };

  return (
    <div
      className="absolute inset-0"
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      style={{ touchAction: isRedactMode ? 'none' : 'auto' }}
    >
      {isDrawing && (
        <div
          id="temp-redaction"
          className="absolute bg-white/50 border-2 border-red-500 pointer-events-none"
        />
      )}
    </div>
  );
};