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

    const canvasElement = document.createElement('canvas');
    const rect = pageRef.getBoundingClientRect();
    canvasElement.width = rect.width;
    canvasElement.height = rect.height;
    canvasElement.style.position = 'absolute';
    canvasElement.style.top = '0';
    canvasElement.style.left = '0';
    canvasElement.style.pointerEvents = 'none';
    pageRef.appendChild(canvasElement);

    const context = canvasElement.getContext('2d');
    if (context) {
      setCanvas(canvasElement);
      setCtx(context);
    }

    return () => {
      pageRef.removeChild(canvasElement);
    };
  }, [pageRef]);

  const startDrawing = useCallback((e: PointerEvent) => {
    if (!ctx || !activeTool || !canvas) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setCurrentPath([{ x, y }]);

    ctx.strokeStyle = activeTool === 'highlighter' ? 'rgba(255, 255, 0, 0.5)' : '#000';
    ctx.lineWidth = activeTool === 'highlighter' ? 20 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [ctx, activeTool, canvas]);

  const draw = useCallback((e: PointerEvent) => {
    if (!isDrawing || !ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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

    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointerout', stopDrawing);

    return () => {
      canvas.removeEventListener('pointerdown', startDrawing);
      canvas.removeEventListener('pointermove', draw);
      canvas.removeEventListener('pointerup', stopDrawing);
      canvas.removeEventListener('pointerout', stopDrawing);
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