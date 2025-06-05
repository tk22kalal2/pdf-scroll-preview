
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Edit3, Save, ArrowRight, ArrowLeft } from "lucide-react";

interface OCREditorProps {
  ocrText: string;
  onSave: (editedText: string) => void;
  onBack: () => void;
  isProcessing: boolean;
}

export const OCREditor = ({ ocrText, onSave, onBack, isProcessing }: OCREditorProps) => {
  const [editedText, setEditedText] = useState(ocrText);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    if (editedText.trim().length === 0) {
      toast.error("OCR text cannot be empty");
      return;
    }
    setIsEditing(false);
    toast.success("OCR text saved successfully");
  };

  const handleContinueToNotes = () => {
    if (editedText.trim().length === 0) {
      toast.error("Please add some text before continuing");
      return;
    }
    onSave(editedText);
  };

  const handleReset = () => {
    setEditedText(ocrText);
    setIsEditing(false);
    toast.info("OCR text reset to original");
  };

  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col h-[85vh]">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Edit3 size={20} />
            Review & Edit OCR Text
          </h2>
          <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
            Step 1 of 2: Edit extracted text
          </span>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save size={16} className="mr-1" />
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit3 size={16} className="mr-1" />
                Edit Text
              </Button>
              <Button variant="outline" size="sm" onClick={onBack}>
                <ArrowLeft size={16} className="mr-1" />
                Back to PDF
              </Button>
              <Button 
                size="sm" 
                onClick={handleContinueToNotes}
                disabled={isProcessing}
              >
                <ArrowRight size={16} className="mr-1" />
                {isProcessing ? "Processing..." : "Generate Notes"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-grow p-4 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Extracted Text from PDF</h3>
            <p className="text-sm text-gray-600 mb-4">
              Review the text below and make any necessary corrections before generating notes. 
              You can add missing text, fix OCR errors, or remove unwanted content.
            </p>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>Characters: {editedText.length}</span>
              <span>Words: {editedText.trim().split(/\s+/).filter(word => word.length > 0).length}</span>
              <span>Lines: {editedText.split('\n').length}</span>
            </div>
          </div>

          <div className="flex-grow">
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder="The extracted text will appear here..."
              className="h-full resize-none font-mono text-sm"
              readOnly={!isEditing}
              style={{ 
                minHeight: "400px",
                backgroundColor: isEditing ? "#ffffff" : "#f8f9fa",
                cursor: isEditing ? "text" : "default"
              }}
            />
          </div>

          {!isEditing && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Tip:</strong> Click "Edit Text" to modify the extracted content. 
                You can fix OCR errors, add missing information, or remove irrelevant text 
                before generating your notes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
