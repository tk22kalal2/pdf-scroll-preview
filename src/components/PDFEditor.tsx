import { RefObject } from 'react';

interface PDFEditorProps {
  pageRef: HTMLDivElement | null;
  onAnnotationsChange: (annotations: any[]) => void;
}

export const PDFEditor = ({ pageRef, onAnnotationsChange }: PDFEditorProps) => {
  return null;
};