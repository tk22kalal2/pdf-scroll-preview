import { useState } from "react";
import { PDFViewer } from "@/components/PDFViewer";
import { FileUpload } from "@/components/FileUpload";
import { PDFHistory } from "@/components/PDFHistory";

const Index = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const handleFileSelect = async (file: File) => {
    setPdfFile(file);
    
    // Save to history
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1];
        const historyItem = {
          name: file.name,
          data: base64Data,
          lastOpened: Date.now(),
        };
        
        const history = JSON.parse(localStorage.getItem("pdfHistory") || "[]");
        const updatedHistory = [
          historyItem,
          ...history.filter((item: any) => item.name !== file.name),
        ].slice(0, 5); // Keep only last 5 PDFs
        
        localStorage.setItem("pdfHistory", JSON.stringify(updatedHistory));
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to save PDF to history:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {!pdfFile ? (
          <>
            <PDFHistory onFileSelect={handleFileSelect} />
            <FileUpload onFileSelect={handleFileSelect} />
          </>
        ) : (
          <PDFViewer file={pdfFile} />
        )}
      </div>
    </div>
  );
};

export default Index;