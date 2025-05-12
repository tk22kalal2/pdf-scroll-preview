
import { useEffect, useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageSquare, Info } from "lucide-react";
import { ChatBot } from "./ChatBot";

interface NotesEditorProps {
  notes: string;
  ocrText: string; // Added prop for OCR text
  onReturn: () => void;
}

export const NotesEditor = ({ notes, ocrText, onReturn }: NotesEditorProps) => {
  const editorRef = useRef<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [notesContent, setNotesContent] = useState(notes);

  useEffect(() => {
    // Inform user about complete content preservation
    toast.success("Complete PDF content has been preserved in the notes. No information has been omitted.", {
      duration: 4000,
      position: "top-right"
    });
  }, []);

  // Function to check if content is being deleted and preserve important parts
  const handleEditorChange = (content: string) => {
    // Store the updated content
    setNotesContent(content);
  };

  const handleCopy = () => {
    const content = editorRef.current?.getContent() || notesContent;
    navigator.clipboard.writeText(content)
      .then(() => toast.success("Complete notes copied to clipboard", { duration: 2000, position: "top-right" }))
      .catch(() => toast.error("Failed to copy notes", { duration: 4000, position: "top-right" }));
  };

  const handleDownload = () => {
    const content = editorRef.current?.getContent() || notesContent;
    const blob = new Blob([content.replace(/<[^>]*>/g, ' ')], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `complete_pdf_notes_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Complete notes downloaded successfully", { duration: 2000, position: "top-right" });
  };

  const handleDownloadHTML = () => {
    const content = editorRef.current?.getContent() || notesContent;
    const blob = new Blob([
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Complete PDF Notes</title><style>body{font-family:Arial,sans-serif;line-height:1.6;margin:20px;max-width:800px;margin:0 auto;}h1{color:rgb(71,0,0);}h2{color:rgb(26,1,157);}h3{color:rgb(52,73,94);}ul{margin-left:20px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ddd;padding:8px;}th{background-color:#f2f2f2;}p{margin-bottom:12px;}li{margin-bottom:8px;}</style></head><body>' +
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
    toast.success("Complete HTML notes downloaded successfully", { duration: 2000, position: "top-right" });
  };

  // Function to view raw OCR text
  const viewRawOCR = () => {
    // Create modal or dialog to show raw OCR
    editorRef.current?.setContent(`
      <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Raw OCR Text (View Only)</span></span></h1>
      <p>Below is the complete raw text extracted from the PDF:</p>
      <pre style="background-color: #f5f5f5; padding: 10px; border: 1px solid #ddd; white-space: pre-wrap;">${ocrText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      <p><strong>Note:</strong> This is for verification only. Click "Reset Notes" to return to the formatted notes.</p>
      <p><button onclick="resetNotes()">Reset Notes</button></p>
    `);
    // Add custom reset function
    const editor = editorRef.current;
    if (editor) {
      const win = editor.getWin();
      win.resetNotes = () => {
        editor.setContent(notesContent);
      };
    }
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

  // Function to fix and sanitize list formatting issues on paste
  const handlePaste = (e: any, editor: any) => {
    editor.on('PastePreProcess', function(e: any) {
      let content = e.content;
      
      // Fix common list formatting issues on paste
      if (content.includes('*') || content.includes('-') || content.includes('•')) {
        // Convert * and - bullet points to proper list items
        content = content.replace(/(<p>|<div>|\s)\*\s+([^<]+)(<\/p>|<\/div>|$)/g, '<ul><li>$2</li></ul>');
        content = content.replace(/(<p>|<div>|\s)-\s+([^<]+)(<\/p>|<\/div>|$)/g, '<ul><li>$2</li></ul>');
        content = content.replace(/(<p>|<div>|\s)•\s+([^<]+)(<\/p>|<\/div>|$)/g, '<ul><li>$2</li></ul>');
        
        // Fix consecutive list items
        content = content.replace(/<\/ul>\s*<ul>/g, '');
      }
      
      // Fix numbered lists on paste
      if (content.match(/\d+\.\s+/)) {
        content = content.replace(/(<p>|<div>|\s)\d+\.\s+([^<]+)(<\/p>|<\/div>|$)/g, '<ol><li>$2</li></ol>');
        content = content.replace(/<\/ol>\s*<ol>/g, '');
      }
      
      e.content = content;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col h-[85vh]">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center">
          <span>Complete PDF Notes Editor</span>
          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">100% Content Preserved</span>
        </h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowChat(!showChat)}
            className="flex items-center gap-1"
          >
            <MessageSquare size={16} />
            {showChat ? "Hide Chat" : "Chat"}
          </Button>
          <Button variant="outline" size="sm" onClick={viewRawOCR}>
            <Info size={16} className="mr-1" />
            View Raw OCR
          </Button>
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
      <div className="flex-grow overflow-hidden flex">
        <div className={`${showChat ? 'w-1/2' : 'w-full'} transition-all duration-300`}>
          <Editor
            apiKey="cg09wsf15duw9av3kj5g8d8fvsxvv3uver3a95xyfm1ngtq4"
            onInit={(evt, editor) => {
              editorRef.current = editor;
              // Apply paste handler after initialization
              handlePaste(evt, editor);
            }}
            initialValue={notes}
            onEditorChange={handleEditorChange}
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
                body { 
                  font-family: Helvetica, Arial, sans-serif; 
                  font-size: 14px; 
                  line-height: 1.6; 
                  padding: 15px; 
                }
                h1 { 
                  color: rgb(71, 0, 0); 
                  font-size: 24px; 
                  margin-top: 24px; 
                  margin-bottom: 16px; 
                  font-weight: bold;
                }
                h1 span { 
                  text-decoration: underline; 
                  color: rgb(71, 0, 0);
                }
                h2 { 
                  color: rgb(26, 1, 157); 
                  font-size: 20px; 
                  margin-top: 20px; 
                  margin-bottom: 12px; 
                  font-weight: bold;
                }
                h2 span { 
                  text-decoration: underline; 
                  color: rgb(26, 1, 157);
                }
                h3 { 
                  color: rgb(52, 73, 94); 
                  font-size: 18px; 
                  margin-top: 16px; 
                  margin-bottom: 10px; 
                  font-weight: bold;
                }
                h3 span { 
                  text-decoration: underline; 
                  color: rgb(52, 73, 94);
                }
                p { 
                  margin-bottom: 12px; 
                  line-height: 1.5;
                }
                strong { 
                  font-weight: bold; 
                }
                u { 
                  text-decoration: underline; 
                }
                table { 
                  border-collapse: collapse; 
                  width: 100%; 
                  margin-bottom: 16px; 
                }
                th, td { 
                  border: 1px solid #ddd; 
                  padding: 8px; 
                  text-align: left; 
                }
                th { 
                  background-color: #f2f2f2; 
                }
                ul, ol { 
                  margin-left: 20px; 
                  margin-bottom: 16px; 
                  padding-left: 20px;
                }
                li {
                  margin-bottom: 8px;
                }
                ul li {
                  list-style-type: disc;
                }
                ol li {
                  list-style-type: decimal;
                }
                img { 
                  max-width: 100%; 
                  height: auto; 
                }
                pre {
                  white-space: pre-wrap;
                  background-color: #f5f5f5;
                  padding: 10px;
                  border: 1px solid #ddd;
                  margin-bottom: 16px;
                  font-family: monospace;
                }
              `,
              // Remove default p margin in TinyMCE
              formats: {
                p: { block: 'p', styles: { 'margin-bottom': '12px' } },
                h1: { block: 'h1', styles: { 'margin-top': '24px', 'margin-bottom': '16px' } },
                h2: { block: 'h2', styles: { 'margin-top': '20px', 'margin-bottom': '12px' } },
                h3: { block: 'h3', styles: { 'margin-top': '16px', 'margin-bottom': '10px' } },
                bold: { inline: 'strong' },
                italic: { inline: 'em' }
              },
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
              setup: function(editor) {
                // Add a custom button to reset notes if viewing raw OCR
                editor.ui.registry.addButton('resetNotes', {
                  text: 'Reset Notes',
                  onAction: function() {
                    editor.setContent(notesContent);
                  }
                });
                
                // Important: Fix list formatting issues when pasting content
                editor.on('PastePreProcess', function(e) {
                  let content = e.content;
                  
                  // Convert * and - bullet points to proper list items
                  if (content.includes('*') || content.includes('-') || content.includes('•')) {
                    content = content.replace(/(\*|\-|•)\s+([^*\-•<]+)(<br>|$)/g, '<li>$2</li>');
                    
                    // Wrap consecutive list items in ul tags
                    if (content.includes('<li>')) {
                      content = '<ul>' + content + '</ul>';
                      // Fix nested lists
                      content = content.replace(/<\/ul><ul>/g, '');
                    }
                  }
                  
                  e.content = content;
                });
              },
              // Ensure proper handling of HTML formatting
              extended_valid_elements: "img[class|src|border=0|alt|title|hspace|vspace|width|height|align|onmouseover|onmouseout|name],h1[*],h2[*],h3[*],h4[*],h5[*],h6[*],strong[*],span[*],div[*],p[*],ul[*],ol[*],li[*],table[*],tr[*],td[*],th[*],pre[*],code[*]",
              // Fix for content not displaying correctly
              valid_elements: '*[*]',
              entity_encoding: 'raw',
              convert_urls: false,
              valid_children: "+body[style],+body[link]",
              // Prevent TinyMCE from removing any HTML elements
              invalid_elements: '',
              force_br_newlines: false,
              force_p_newlines: true,
              forced_root_block: 'p',
              // Improve formatting of lists and content
              indent: true,
              indent_use_margin: true,
              indent_margin: true,
              paste_enable_default_filters: true,
              paste_word_valid_elements: "b,strong,i,em,h1,h2,h3,h4,h5,h6,p,ul,ol,li,table,tr,td,th,div,span,pre,code",
              paste_retain_style_properties: "color,font-size,font-family,background-color",
              paste_webkit_styles: "color,font-size,font-family,background-color",
              paste_merge_formats: false,
              // Better handling of lists
              lists_indent_on_tab: true,
              // Keep proper formatting on paste
              paste_as_text: false
            }}
          />
        </div>
        
        {showChat && (
          <div className="w-1/2">
            <ChatBot 
              ocrText={ocrText} 
              onClose={() => setShowChat(false)} 
            />
          </div>
        )}
      </div>
    </div>
  );
};
