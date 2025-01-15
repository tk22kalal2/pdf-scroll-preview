import { Clock, File as FileIcon } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { toast } from "sonner";

interface PDFHistoryProps {
  onFileSelect: (file: File) => void;
}

interface PDFHistoryItem {
  name: string;
  data: string; // Base64 encoded PDF data
  lastOpened: number;
}

export const PDFHistory = ({ onFileSelect }: PDFHistoryProps) => {
  const getHistory = (): PDFHistoryItem[] => {
    try {
      return JSON.parse(localStorage.getItem("pdfHistory") || "[]");
    } catch {
      return [];
    }
  };

  const handleFileOpen = async (historyItem: PDFHistoryItem) => {
    try {
      // Convert base64 string back to binary data
      const binaryStr = atob(historyItem.data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      
      // Create a blob from the binary data
      const blob = new Blob([bytes], { type: "application/pdf" });
      const file = blob as File;
      Object.defineProperty(file, 'name', {
        value: historyItem.name,
        writable: false
      });
      
      onFileSelect(file);
    } catch (error) {
      toast.error("Could not open the file. It may have been corrupted.");
    }
  };

  const history = getHistory();

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-700">Recent PDFs</h2>
      </div>
      <ScrollArea className="h-[120px]">
        <div className="grid gap-2">
          {history.map((item, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleFileOpen(item)}
            >
              <FileIcon className="w-4 h-4 mr-2" />
              <span className="truncate">{item.name}</span>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};