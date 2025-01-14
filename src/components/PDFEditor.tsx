import { RefObject, useState, useEffect, useCallback } from 'react';
import { Pencil, Highlighter, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Tool = "pencil" | "highlighter" | "eraser" | null;

interface PDFEditorProps {
  pageRef: HTMLDivElement | null;
  onAnnotationsChange: (annotations: any[]) => void;
}

export const PDFEditor = ({ pageRef, onAnnotationsChange }: PDFEditorProps) => {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (!pageRef) return;

    // Remove any existing canvas
    const existingCanvas = pageRef.querySelector('canvas');
    if (existingCanvas) {
      pageRef.removeChild(existingCanvas);
    }

    const canvasElement = document.createElement('canvas');
    const rect = pageRef.getBoundingClientRect();
    canvasElement.width = rect.width;
    canvasElement.height = rect.height;
    canvasElement.style.position = 'absolute';
    canvasElement.style.top = '0';
    canvasElement.style.left = '0';
    canvasElement.style.pointerEvents = activeTool ? 'auto' : 'none';
    canvasElement.style.cursor = activeTool ? 'crosshair' : 'default';
    pageRef.style.position = 'relative';
    pageRef.appendChild(canvasElement);

    const context = canvasElement.getContext('2d');
    if (context) {
      setCanvas(canvasElement);
      setCtx(context);
    }

    return () => {
      if (pageRef.contains(canvasElement)) {
        pageRef.removeChild(canvasElement);
      }
    };
  }, [pageRef, activeTool]);

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    if (!ctx || !activeTool || !canvas) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if (e instanceof MouseEvent) {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setCurrentPath([{ x, y }]);

    if (activeTool === 'highlighter') {
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
      ctx.lineWidth = 20;
    } else if (activeTool === 'pencil') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
    } else if (activeTool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 20;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [ctx, activeTool, canvas]);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing || !ctx || !canvas) return;

    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if (e instanceof MouseEvent) {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    setCurrentPath(prev => [...prev, { x, y }]);
  }, [isDrawing, ctx, canvas]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing || !ctx) return;

    setIsDrawing(false);
    ctx.closePath();
    onAnnotationsChange([
      {
        tool: activeTool,
        path: currentPath,
      },
    ]);
    setCurrentPath([]);
  }, [isDrawing, ctx, activeTool, currentPath, onAnnotationsChange]);

  useEffect(() => {
    if (!canvas) return;

    // Add both mouse and touch event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);

      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [canvas, startDrawing, draw, stopDrawing]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2" />
          Edit PDF
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Drawing Tools</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 mt-4">
          <Button
            variant={activeTool === "pencil" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTool(activeTool === "pencil" ? null : "pencil")}
          >
            <Pencil className="mr-2" />
            Draw
          </Button>
          <Button
            variant={activeTool === "highlighter" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTool(activeTool === "highlighter" ? null : "highlighter")}
          >
            <Highlighter className="mr-2" />
            Highlight
          </Button>
          <Button
            variant={activeTool === "eraser" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTool(activeTool === "eraser" ? null : "eraser")}
          >
            <Eraser className="mr-2" />
            Erase
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};