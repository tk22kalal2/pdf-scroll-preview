import { toast } from "sonner";
import * as Tesseract from 'tesseract.js';
import { analyzeDocumentStructure } from './documentStructure';
import { createStructuredChunks } from './contentChunking';
import { processChunksHierarchically, ProcessingProgress } from './hierarchicalProcessor';

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
    
    console.log(`Starting OCR for ${pageNumbers.length} pages`);
    
    // Process each requested page
    for (const pageNum of pageNumbers) {
      if (pageNum > pdf.numPages || pageNum < 1) continue;
      
      console.log(`Processing page ${pageNum}...`);
      
      // Try to extract text using PDF.js first (works for text-based PDFs)
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      let pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      console.log(`Page ${pageNum} extracted text length: ${pageText.length}`);
      
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
                  console.log(`OCR Progress: ${Math.floor(m.progress * 100)}%`);
                }
              }
            }
          );
          
          // Add the recognized text
          pageText += ' ' + result.data.text;
        }
        
        console.log(`Page ${pageNum} OCR completed, total text length: ${pageText.length}`);
      }
      
      fullText += `Page ${pageNum}:\n${pageText.trim()}\n\n`;
    }
    
    if (imageBasedPagesCount > 0) {
      toast.success(`Advanced OCR completed on ${imageBasedPagesCount} image-based pages`);
    }
    
    console.log(`Total OCR completed: ${fullText.length} characters from ${pageNumbers.length} pages`);
    return { text: fullText || "No text found in the PDF." };
  } catch (error) {
    console.error("OCR Error:", error);
    toast.error("Failed to extract text from PDF");
    throw error;
  }
};

/**
 * Converts OCR text to notes using hierarchical processing for large documents
 * @param ocrText The text from OCR
 * @returns The formatted notes
 */
export const generateNotesFromText = async (ocrText: string): Promise<NotesResult> => {
  try {
    console.log(`Starting notes generation for ${ocrText.length} characters`);
    
    // Phase 1: Analyze document structure
    toast.loading("Analyzing document structure...", { id: "notes-progress" });
    const documentStructure = analyzeDocumentStructure(ocrText);
    
    console.log("Document structure analysis complete:", {
      headings: documentStructure.headings.length,
      sections: documentStructure.sections.length,
      totalLength: documentStructure.totalLength,
      pageBreaks: documentStructure.pageBreaks.length
    });
    
    // Log found headings for debugging
    documentStructure.headings.forEach((heading, index) => {
      console.log(`Heading ${index + 1}: Level ${heading.level} - "${heading.text}"`);
    });
    
    // Phase 2: Create structured chunks
    toast.loading("Creating intelligent content chunks...", { id: "notes-progress" });
    const chunkingResult = createStructuredChunks(ocrText, documentStructure);
    
    console.log("Chunking analysis complete:", {
      totalChunks: chunkingResult.totalChunks,
      totalContentLength: chunkingResult.totalContentLength,
      chunks: chunkingResult.chunks.map(c => ({ 
        id: c.id, 
        tokenCount: c.tokenCount, 
        contentLength: c.content.length,
        pageNumbers: c.pageNumbers 
      }))
    });
    
    // Verify chunking didn't lose content
    const totalChunkContent = chunkingResult.chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    console.log(`Content preservation check: ${totalChunkContent}/${ocrText.length} characters (${Math.round(totalChunkContent/ocrText.length*100)}%)`);
    
    // Phase 3: Process chunks hierarchically
    let currentProgress = { currentChunk: 0, totalChunks: chunkingResult.totalChunks };
    
    const onProgress = (progress: ProcessingProgress) => {
      currentProgress = progress;
      let message = progress.message;
      
      if (progress.phase === 'processing') {
        message = `Processing section ${progress.currentChunk} of ${progress.totalChunks}...`;
      } else if (progress.phase === 'merging') {
        message = "Merging all sections into complete notes...";
      }
      
      toast.loading(message, { id: "notes-progress" });
    };
    
    const finalNotes = await processChunksHierarchically(chunkingResult, onProgress);
    
    toast.dismiss("notes-progress");
    
    console.log(`Final notes generated: ${finalNotes.length} characters`);
    
    if (!finalNotes || finalNotes.trim().length === 0) {
      throw new Error("Empty response from hierarchical processing");
    }
    
    // Clean and validate HTML formatting
    const cleanedNotes = cleanHtmlFormatting(finalNotes);
    
    console.log(`Cleaned notes: ${cleanedNotes.length} characters`);
    
    return { notes: cleanedNotes };
    
  } catch (error) {
    console.error("Hierarchical processing error:", error);
    toast.dismiss("notes-progress");
    toast.error("Failed to generate notes. Using enhanced fallback formatting.", {
      duration: 3000,
      position: "top-right"
    });
    
    // Enhanced fallback formatting
    console.log("Creating fallback notes...");
    const fallbackNotes = createFallbackHtmlNotes(ocrText);
    console.log(`Fallback notes created: ${fallbackNotes.length} characters`);
    
    return { notes: fallbackNotes };
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
