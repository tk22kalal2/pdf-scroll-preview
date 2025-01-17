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

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    if ('touches' in e) {
      // Touch event
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isRedactMode) return;
    
    const point = getCoordinates(e);
    setIsDrawing(true);
    setStartPoint(point);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isRedactMode || !isDrawing || !startPoint) return;
    
    const currentPoint = getCoordinates(e);
    
    const width = currentPoint.x - startPoint.x;
    const height = currentPoint.y - startPoint.y;
    
    const tempRedaction = document.getElementById('temp-redaction');
    if (tempRedaction) {
      tempRedaction.style.width = `${Math.abs(width)}px`;
      tempRedaction.style.height = `${Math.abs(height)}px`;
      tempRedaction.style.left = `${width > 0 ? startPoint.x : currentPoint.x}px`;
      tempRedaction.style.top = `${height > 0 ? startPoint.y : currentPoint.y}px`;
    }
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isRedactMode || !isDrawing || !startPoint) return;
    
    const endPoint = 'changedTouches' in e 
      ? {
          x: e.changedTouches[0].clientX - (e.currentTarget as HTMLDivElement).getBoundingClientRect().left,
          y: e.changedTouches[0].clientY - (e.currentTarget as HTMLDivElement).getBoundingClientRect().top
        }
      : {
          x: e.clientX - (e.currentTarget as HTMLDivElement).getBoundingClientRect().left,
          y: e.clientY - (e.currentTarget as HTMLDivElement).getBoundingClientRect().top
        };
    
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    
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