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

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.preventDefault(); // Prevent scrolling
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    return null;
  };

  const handleStart = (e: React.PointerEvent) => {
    if (!isRedactMode) return;
    
    const point = getCoordinates(e);
    if (point) {
      setIsDrawing(true);
      setStartPoint(point);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!isRedactMode || !isDrawing || !startPoint) return;
    e.preventDefault();
    
    const currentPoint = getCoordinates(e);
    if (!currentPoint) return;
    
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

  const handleEnd = (e: React.PointerEvent) => {
    if (!isRedactMode || !isDrawing || !startPoint) return;
    e.preventDefault();
    
    const endPoint = getCoordinates(e);
    if (!endPoint) return;
    
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
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      style={{ 
        touchAction: isRedactMode ? 'none' : 'auto',
        cursor: isRedactMode ? 'crosshair' : 'auto'
      }}
    >
      {isDrawing && (
        <div
          id="temp-redaction"
          className="absolute bg-blue-400/30 border-2 border-blue-500 pointer-events-none"
          style={{ 
            boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.5)',
            backdropFilter: 'blur(1px)'
          }}
        />
      )}
    </div>
  );
};