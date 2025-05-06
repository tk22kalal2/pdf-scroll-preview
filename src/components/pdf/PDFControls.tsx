
import { useState } from "react";
import { Split, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface PDFControlsProps {
  isLoading: boolean;
  numPages: number;
  onSplit: (start: number, end: number) => void;
  onDownload: () => void;
  onGenerateNotes?: () => void;
  isSplit: boolean;
}

export const PDFControls = ({ isLoading, numPages, onSplit, onDownload, onGenerateNotes, isSplit }: PDFControlsProps) => {
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");

  const handleSplit = () => {
    const start = parseInt(startPage);
    const end = parseInt(endPage);

    if (isNaN(start) || isNaN(end)) {
      toast.error("Please enter valid page numbers");
      return;
    }

    if (start < 1 || end > numPages || start > end) {
      toast.error(`Please enter page numbers between 1 and ${numPages}`);
      return;
    }

    onSplit(start, end);
  };

  return (
    <div className="flex gap-2 p-4 border-b">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            <Split className="mr-2" />
            Split PDF
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Split PDF</DialogTitle>
            <DialogDescription>
              Enter the range of pages you want to split from the PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-4">
              <Input
                type="number"
                placeholder="Start page"
                value={startPage}
                onChange={(e) => setStartPage(e.target.value)}
                min={1}
                max={numPages}
              />
              <span>to</span>
              <Input
                type="number"
                placeholder="End page"
                value={endPage}
                onChange={(e) => setEndPage(e.target.value)}
                min={1}
                max={numPages}
              />
            </div>
            <Button onClick={handleSplit}>Split</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Button variant="outline" size="sm" onClick={onDownload} disabled={isLoading}>
        <Download className="mr-2" />
        Download
      </Button>
      {onGenerateNotes && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onGenerateNotes} 
          disabled={isLoading || !isSplit}
        >
          <FileText className="mr-2" />
          Notes
        </Button>
      )}
    </div>
  );
};
