import { useState } from "react";
import { PDFViewer } from "@/components/PDFViewer";
import { FileUpload } from "@/components/FileUpload";

const Index = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {!pdfFile ? (
          <FileUpload onFileSelect={setPdfFile} />
        ) : (
          <PDFViewer file={pdfFile} />
        )}
      </div>
    </div>
  );
};

export default Index;