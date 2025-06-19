
import { toast } from "sonner";
import * as Tesseract from 'tesseract.js';
import { processOCRInChunks } from './chunkProcessor';

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
    
    console.log("OCR Text Length:", fullText.length);
    console.log("OCR Text Preview:", fullText.substring(0, 500) + "...");
    return { text: fullText || "No text found in the PDF." };
  } catch (error) {
    console.error("OCR Error:", error);
    toast.error("Failed to extract text from PDF");
    throw error;
  }
};

/**
 * Converts OCR text to notes using chunked processing for large documents
 * @param ocrText The text from OCR
 * @param onProgress Optional progress callback
 * @returns The formatted notes
 */
export const generateNotesFromText = async (
  ocrText: string, 
  onProgress?: (current: number, total: number, status: string) => void
): Promise<NotesResult> => {
  try {
    console.log("Starting chunked note generation for text length:", ocrText.length);
    
    // Use chunked processing for better handling of large documents
    const notes = await processOCRInChunks(ocrText, onProgress);
    
    if (!notes || notes.trim().length === 0) {
      throw new Error("Empty response from chunked processing");
    }
    
    console.log("Generated notes length:", notes.length);
    return { notes };
    
  } catch (error) {
    console.error("Chunked processing error:", error);
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
