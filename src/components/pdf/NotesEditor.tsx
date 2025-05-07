
import { useEffect, useRef } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NotesEditorProps {
  notes: string;
  onReturn: () => void;
}

export const NotesEditor = ({ notes, onReturn }: NotesEditorProps) => {
  const editorRef = useRef<any>(null);

  const handleCopy = () => {
    const content = editorRef.current?.getContent() || notes;
    navigator.clipboard.writeText(content)
      .then(() => toast.success("Notes copied to clipboard"))
      .catch(() => toast.error("Failed to copy notes"));
  };

  const handleDownload = () => {
    const content = editorRef.current?.getContent() || notes;
    const blob = new Blob([content.replace(/<[^>]*>/g, ' ')], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pdf_notes_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Notes downloaded successfully");
  };

  const handleDownloadHTML = () => {
    const content = editorRef.current?.getContent() || notes;
    const blob = new Blob([
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>PDF Notes</title></head><body>' +
      content +
      '</body></html>'
    ], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pdf_notes_${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("HTML notes downloaded successfully");
  };

  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col h-[85vh]">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-semibold">PDF Notes Editor</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            Download Text
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadHTML}>
            Download HTML
          </Button>
          <Button variant="outline" size="sm" onClick={onReturn}>
            Return to PDF
          </Button>
        </div>
      </div>
      <div className="flex-grow overflow-hidden">
        <Editor
          apiKey="cg09wsf15duw9av3kj5g8d8fvsxvv3uver3a95xyfm1ngtq4"
          onInit={(evt, editor) => editorRef.current = editor}
          initialValue={notes}
          init={{
            height: "100%",
            menubar: true,
            plugins: [
              'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 
              'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
              'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
            ],
            toolbar: 'undo redo | blocks | ' +
              'bold italic forecolor | alignleft aligncenter ' +
              'alignright alignjustify | bullist numlist outdent indent | ' +
              'removeformat | table | help',
            content_style: `
              body { font-family:Helvetica,Arial,sans-serif; font-size:14px }
              h1 { color: rgb(71, 0, 0); }
              h2 { color: rgb(26, 1, 157); }
              h3 { color: rgb(52, 73, 94); }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; }
              th { background-color: #f2f2f2; }
              ul, ol { margin-left: 20px; }
            `
          }}
        />
      </div>
    </div>
  );
};
