import React, { useState } from "react";
import { Pencil, Highlighter, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tool = "pencil" | "highlighter" | "eraser" | null;

interface PDFEditorProps {
  pageRef: React.RefObject<HTMLDivElement>;
  onAnnotationsChange: (annotations: any[]) => void;
}

export const PDFEditor = ({ pageRef, onAnnotationsChange }: PDFEditorProps) => {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!activeTool || !pageRef.current) return;

    setIsDrawing(true);
    const rect = pageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPath([{ x, y }]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPath((prev) => [...prev, { x, y }]);
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;

    setIsDrawing(false);
    onAnnotationsChange([
      {
        tool: activeTool,
        path: currentPath,
      },
    ]);
    setCurrentPath([]);
  };

  return (
    <div className="flex gap-2 p-2 border-b">
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
  );
};