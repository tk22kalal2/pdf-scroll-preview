import { useState } from "react";
import { Button } from "../ui/button";
import { Square } from "lucide-react";
import { toast } from "sonner";

export interface Redaction {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PDFRedactionManagerProps {
  isRedactMode: boolean;
  onRedactModeChange: (mode: boolean) => void;
  redactions: Redaction[];
}

export const PDFRedactionManager = ({
  isRedactMode,
  onRedactModeChange,
  redactions
}: PDFRedactionManagerProps) => {
  return (
    <Button
      variant={isRedactMode ? "destructive" : "outline"}
      onClick={() => {
        onRedactModeChange(!isRedactMode);
        toast.info(
          isRedactMode 
            ? "Redact mode disabled" 
            : "Redact mode enabled. Use mouse, touch, or stylus to cover areas."
        );
      }}
      className="ml-4"
    >
      <Square className="mr-2" />
      {isRedactMode ? "Exit Redact" : "Redact"}
    </Button>
  );
};