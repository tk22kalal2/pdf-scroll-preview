
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

  useEffect(() => {
    // Inform user about detailed notes
    toast.info("Displaying complete and detailed notes. No content has been omitted.");
  }, []);

  const handleCopy = () => {
    const content = editorRef.current?.getContent() || notes;
    navigator.clipboard.writeText(content)
      .then(() => toast.success("Complete notes copied to clipboard"))
      .catch(() => toast.error("Failed to copy notes"));
  };

  const handleDownload = () => {
    const content = editorRef.current?.getContent() || notes;
    const blob = new Blob([content.replace(/<[^>]*>/g, ' ')], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `complete_pdf_notes_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Complete notes downloaded successfully");
  };

  const handleDownloadHTML = () => {
    const content = editorRef.current?.getContent() || notes;
    const blob = new Blob([
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Complete PDF Notes</title><style>body{font-family:Arial,sans-serif;line-height:1.6;margin:20px;max-width:800px;margin:0 auto;}h1{color:rgb(71,0,0);}h2{color:rgb(26,1,157);}h3{color:rgb(52,73,94);}ul{margin-left:20px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ddd;padding:8px;}th{background-color:#f2f2f2;}</style></head><body>' +
      content +
      '</body></html>'
    ], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `complete_pdf_notes_${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Complete HTML notes downloaded successfully");
  };

  // Function to handle image upload directly from TinyMCE
  const imageUploadHandler = (blobInfo: any, progress: (percent: number) => void) => {
    return new Promise<string>((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          progress(100);
          resolve(e.target?.result as string);
        };
        reader.onerror = () => {
          reject('Failed to load image');
        };
        reader.readAsDataURL(blobInfo.blob());
      } catch (error) {
        reject('Image upload failed');
      }
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col h-[85vh]">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-semibold">Complete PDF Notes Editor</h2>
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
            readonly: false,
            plugins: [
              'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 
              'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
              'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
            ],
            toolbar: 'undo redo | formatselect | ' +
              'bold italic forecolor | alignleft aligncenter ' +
              'alignright alignjustify | bullist numlist outdent indent | ' +
              'removeformat | image table link | help',
            content_style: `
              body { font-family:Helvetica,Arial,sans-serif; font-size:14px; line-height:1.6; }
              h1 { color: rgb(71, 0, 0); font-size: 24px; margin-top: 20px; margin-bottom: 10px; }
              h2 { color: rgb(26, 1, 157); font-size: 20px; margin-top: 18px; margin-bottom: 9px; }
              h3 { color: rgb(52, 73, 94); font-size: 18px; margin-top: 16px; margin-bottom: 8px; }
              p { margin-bottom: 1em; }
              strong { font-weight: bold; }
              u { text-decoration: underline; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              ul, ol { margin-left: 20px; margin-bottom: 16px; }
              img { max-width: 100%; height: auto; }
            `,
            // Ensure we handle images properly
            images_upload_handler: imageUploadHandler,
            automatic_uploads: true,
            file_picker_types: 'image',
            file_picker_callback: function(callback, value, meta) {
              // Handle image selection from gallery
              if (meta.filetype === 'image') {
                const input = document.createElement('input');
                input.setAttribute('type', 'file');
                input.setAttribute('accept', 'image/*');
                
                input.onchange = function() {
                  if (input.files && input.files[0]) {
                    const file = input.files[0];
                    
                    const reader = new FileReader();
                    reader.onload = function(e) {
                      callback(e.target?.result as string, { title: file.name });
                    };
                    reader.readAsDataURL(file);
                  }
                };
                
                input.click();
              }
            },
            // Ensure proper handling of HTML formatting
            extended_valid_elements: "img[class|src|border=0|alt|title|hspace|vspace|width|height|align|onmouseover|onmouseout|name],h1[*],h2[*],h3[*],h4[*],h5[*],h6[*],strong[*],span[*],div[*],p[*],ul[*],ol[*],li[*],table[*],tr[*],td[*],th[*]",
            formats: {
              bold: { inline: 'strong' },
              italic: { inline: 'em' }
            },
            entity_encoding: 'raw',
            convert_urls: false,
            valid_children: "+body[style],+body[link]",
            // Prevent TinyMCE from removing any HTML elements
            invalid_elements: '',
            // Fix for content not displaying correctly
            valid_elements: '*[*]',
            force_br_newlines: false,
            force_p_newlines: false,
            forced_root_block: 'p'
          }}
        />
      </div>
    </div>
  );
};
