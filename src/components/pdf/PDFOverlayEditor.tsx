import { useState } from 'react';
import { Button } from "../ui/button";
import { Overlay } from "./Overlay";

interface PDFOverlayEditorProps {
  showOverlay: boolean;
  overlays: Array<{ top: number; left: number; width: number; height: number }>;
  isEditing: boolean;
  onAddOverlay: () => void;
  onApplyChanges: () => void;
  onOverlayChange: (index: number, position: { top: number; left: number; width: number; height: number }) => void;
}

export const PDFOverlayEditor = ({
  showOverlay,
  overlays,
  isEditing,
  onAddOverlay,
  onApplyChanges,
  onOverlayChange
}: PDFOverlayEditorProps) => {
  return (
    <div className="flex gap-2">
      <Button onClick={onAddOverlay} variant="outline">
        Add Overlay
      </Button>
      {showOverlay && overlays.length > 0 && (
        <Button onClick={onApplyChanges} variant="default">
          Apply Changes
        </Button>
      )}
    </div>
  );
};