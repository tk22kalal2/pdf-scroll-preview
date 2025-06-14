
import { toast } from "sonner";
import * as Tesseract from 'tesseract.js';

export interface OcrResult {
  text: string;
}

export interface NotesResult {
  notes: string;
}

/**
 * Extracts images from PDF pages
 * @param pdf The loaded PDF document
 * @param pageNumber The page number to extract images from
 * @returns Array of image data URLs
 */
const extractImagesFromPage = async (pdf: any, pageNumber: number): Promise<string[]> => {
  const page = await pdf.getPage(pageNumber);
  const operatorList = await page.getOperatorList();
  const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better image quality
  
  const images: string[] = [];
  
  // Create a canvas to render the page
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return images;
  
  // Render the page to the canvas
  await page.render({
    canvasContext: ctx,
    viewport: viewport
  }).promise;
  
  // Get the image data URL for the full page
  const imageDataUrl = canvas.toDataURL('image/png');
  images.push(imageDataUrl);
  
  return images;
}

/**
 * Performs OCR on PDF pages using either PDF.js text extraction or Tesseract for image-based PDFs
 * @param file The PDF file
 * @param pageNumbers Array of page numbers to process
 * @returns The OCR result
 */
export const performOCR = async (file: File, pageNumbers: number[]): Promise<OcrResult> => {
  try {
    // Import PDF.js
    const pdfjs = await import('pdfjs-dist');
    const pdfjsLib = pdfjs;
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    
    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    
    let fullText = '';
    let imageBasedPagesCount = 0;
    
    // Process each requested page
    for (const pageNum of pageNumbers) {
      if (pageNum > pdf.numPages || pageNum < 1) continue;
      
      // Try to extract text using PDF.js first (works for text-based PDFs)
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      let pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      // If not enough text was extracted, fallback to Tesseract OCR
      if (pageText.trim().length < 50) {
        toast.loading(`Page ${pageNum} appears to be image-based, using advanced OCR...`);
        imageBasedPagesCount++;
        
        // Extract images from the page
        const images = await extractImagesFromPage(pdf, pageNum);
        
        // Process each image with Tesseract
        for (const imageUrl of images) {
          // Use Tesseract.js to perform OCR on the image
          const result = await Tesseract.recognize(
            imageUrl,
            'eng',
            {
              logger: (m) => {
                // Optional: Log progress to console
                if (m.status === 'recognizing text') {
                  console.log(`Recognizing text: ${Math.floor(m.progress * 100)}%`);
                }
              }
            }
          );
          
          // Add the recognized text
          pageText += ' ' + result.data.text;
        }
      }
      
      fullText += `Page ${pageNum}:\n${pageText.trim()}\n\n`;
    }
    
    if (imageBasedPagesCount > 0) {
      toast.success(`Advanced OCR completed on ${imageBasedPagesCount} image-based pages`);
    }
    
    console.log("OCR Text:", fullText);
    return { text: fullText || "No text found in the PDF." };
  } catch (error) {
    console.error("OCR Error:", error);
    toast.error("Failed to extract text from PDF");
    throw error;
  }
};

/**
 * Converts OCR text to notes using Groq API
 * @param ocrText The text from OCR
 * @returns The formatted notes
 */
export const generateNotesFromText = async (ocrText: string): Promise<NotesResult> => {
  try {
    const GROQ_API_KEY = "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";
    const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    
    console.log("Using Groq API to generate notes");
    
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "system",
            content: `You are an expert note creator. Create complete HTML-formatted notes from PDF text with proper three-level list structures.

RULES:
1. Use ONLY HTML formatting (no Markdown)
2. Include ALL information from the PDF
3. Use simple language (7th grade level)
4. Wrap key terms and main concepts in <strong> tags
5. Use proper HTML structure with three-level lists

FORMATTING:
- Main headings: <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Title</span></span></h1>
- Section headings: <h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">Section</span></span></h2>
- Sub-headings: <h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">Sub-section</span></span></h3>
- Paragraphs: <p>Content with <strong>key terms</strong></p>

THREE-LEVEL BULLET LISTS:
- Level 1: <ul><li>Main point with <strong>key terms</strong></li></ul>
- Level 2: <ul><li>Main point<ul><li>Sub-point with details</li></ul></li></ul>
- Level 3: <ul><li>Main point<ul><li>Sub-point<ul><li>Detailed sub-point</li></ul></li></ul></li></ul>

THREE-LEVEL NUMBERED LISTS:
- Level 1: <ol><li>First main item with <strong>key terms</strong></li></ol>
- Level 2: <ol><li>Main item<ol><li>Sub-item with details</li></ol></li></ol>
- Level 3: <ol><li>Main item<ol><li>Sub-item<ol><li>Detailed sub-item</li></ol></li></ol></li></ol>

WHEN TO USE LISTS:
- Use bullet lists for related items, features, symptoms, characteristics
- Use numbered lists for procedures, steps, chronological events, rankings
- Create three levels when content has main points, sub-points, and details
- Always highlight important terms within list items using <strong> tags

Add proper spacing between sections and ensure all content is preserved.`
          },
          {
            role: "user",
            content: `Create detailed HTML notes with proper three-level list formatting from this PDF text: ${ocrText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Groq API error response:", errorData);
      throw new Error(`Groq API error: ${response.status}`);
    }
    
    const data = await response.json();
    const notes = data.choices[0].message.content;
    
    if (!notes || notes.trim().length === 0) {
      throw new Error("Empty response from Groq API");
    }
    
    // Clean and validate HTML formatting
    const cleanedNotes = cleanHtmlFormatting(notes);
    
    return { notes: cleanedNotes };
    
  } catch (error) {
    console.error("Groq API Error:", error);
    toast.error("Failed to generate notes. Using fallback formatting.", {
      duration: 3000,
      position: "top-right"
    });
    
    // Enhanced fallback formatting
    return { notes: createFallbackHtmlNotes(ocrText) };
  }
};

/**
 * Creates fallback HTML notes when API fails
 */
function createFallbackHtmlNotes(ocrText: string): string {
  let html = `<h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Complete PDF Content</span></span></h1>`;
  
  // Split into pages if multiple pages exist
  const pages = ocrText.split(/Page \d+:/g).filter(page => page.trim().length > 0);
  
  if (pages.length > 1) {
    pages.forEach((pageContent, index) => {
      if (index === 0 && pageContent.trim().length === 0) return; // Skip empty first split
      
      html += `<h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">Page ${index + 1}</span></span></h2>`;
      html += formatPageContent(pageContent.trim());
    });
  } else {
    html += formatPageContent(ocrText);
  }
  
  return html;
}

/**
 * Formats page content into proper HTML
 */
function formatPageContent(content: string): string {
  // Split into paragraphs
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  let html = '';
  
  paragraphs.forEach(paragraph => {
    const trimmed = paragraph.trim();
    if (!trimmed) return;
    
    // Check if it's a potential heading (short line, no punctuation at end)
    if (trimmed.length < 60 && !trimmed.endsWith('.') && !trimmed.endsWith(',')) {
      html += `<h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">${trimmed}</span></span></h3>`;
    } else {
      // Regular paragraph - highlight potential key terms
      const highlighted = trimmed.replace(/\b([A-Z][a-z]{2,}|[A-Z]{2,})\b/g, '<strong>$1</strong>');
      html += `<p>${highlighted}</p>`;
    }
  });
  
  return html;
}

/**
 * Cleans and validates HTML formatting for TinyMCE
 */
function cleanHtmlFormatting(html: string): string {
  return html
    // Remove any markdown syntax that might have slipped through
    .replace(/##\s+/g, '')
    .replace(/###\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    
    // Ensure proper spacing after headings
    .replace(/<\/(h[1-6])>/g, '</$1>\n\n')
    .replace(/<\/(p|ul|ol)>/g, '</$1>\n')
    
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    
    // Ensure proper paragraph structure
    .replace(/^(?!<[h|u|o|p])/gm, '<p>')
    .replace(/(?<!>)$/gm, '</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[h|u|o])/g, '$1')
    .replace(/(<\/[h|u|o][^>]*>)<\/p>/g, '$1');
}
