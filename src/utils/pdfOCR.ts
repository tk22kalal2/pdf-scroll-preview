
import { toast } from "sonner";
import * as Tesseract from 'tesseract.js';

export interface OcrResult {
  text: string;
  pageResults: PageOcrResult[];
}

export interface PageOcrResult {
  pageNumber: number;
  text: string;
  method: 'pdf-text' | 'tesseract-ocr';
  confidence?: number;
}

/**
 * Extracts images from PDF pages with higher quality
 */
const extractImagesFromPage = async (pdf: any, pageNumber: number): Promise<string[]> => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 3.0 }); // Increased scale for better OCR accuracy
  
  const images: string[] = [];
  
  // Create a canvas to render the page
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return images;
  
  // Render the page to the canvas with high quality
  await page.render({
    canvasContext: ctx,
    viewport: viewport,
    renderInteractiveForms: false
  }).promise;
  
  // Get the image data URL for the full page
  const imageDataUrl = canvas.toDataURL('image/png', 1.0); // Maximum quality
  images.push(imageDataUrl);
  
  return images;
}

/**
 * Performs enhanced OCR on PDF pages with improved accuracy
 */
export const performOCR = async (file: File, pageNumbers: number[]): Promise<OcrResult> => {
  try {
    const pdfjs = await import('pdfjs-dist');
    const pdfjsLib = pdfjs;
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    
    let fullText = '';
    const pageResults: PageOcrResult[] = [];
    
    // Process each page individually
    for (const pageNum of pageNumbers) {
      if (pageNum > pdf.numPages || pageNum < 1) continue;
      
      console.log(`Processing PAGE ${pageNum} OCR...`);
      toast.loading(`Processing PAGE ${pageNum} OCR...`, {
        position: "top-right",
        id: `ocr-page-${pageNum}`
      });
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      let pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();
      
      let method: 'pdf-text' | 'tesseract-ocr' = 'pdf-text';
      let confidence: number | undefined;
      
      // Enhanced threshold - if less than 100 characters, use OCR
      if (pageText.length < 100) {
        console.log(`PAGE ${pageNum}: Text extraction insufficient (${pageText.length} chars), using Tesseract OCR`);
        
        toast.loading(`PAGE ${pageNum}: Using advanced OCR for better accuracy...`, {
          position: "top-right",
          id: `ocr-page-${pageNum}`
        });
        
        method = 'tesseract-ocr';
        const images = await extractImagesFromPage(pdf, pageNum);
        
        // Enhanced Tesseract processing with correct options format
        for (const imageUrl of images) {
          const result = await Tesseract.recognize(
            imageUrl,
            'eng',
            {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  console.log(`PAGE ${pageNum} OCR Progress: ${Math.floor(m.progress * 100)}%`);
                }
              }
            }
          );
          
          confidence = result.data.confidence;
          pageText = result.data.text.trim();
          
          console.log(`PAGE ${pageNum} OCR Confidence: ${confidence}%`);
        }
      }
      
      // Clean and format the page text
      pageText = cleanPageText(pageText);
      
      // Add clear page marker
      const pageMarker = `\n\n=== PAGE ${pageNum} OCR START ===\n`;
      const pageEndMarker = `\n=== PAGE ${pageNum} OCR END ===\n\n`;
      const formattedPageText = pageMarker + pageText + pageEndMarker;
      
      fullText += formattedPageText;
      
      pageResults.push({
        pageNumber: pageNum,
        text: pageText,
        method,
        confidence
      });
      
      toast.dismiss(`ocr-page-${pageNum}`);
      toast.success(`PAGE ${pageNum} OCR completed (${method})`, {
        position: "top-right",
        duration: 2000
      });
      
      console.log(`PAGE ${pageNum} OCR Complete:`, {
        method,
        textLength: pageText.length,
        confidence: confidence || 'N/A'
      });
    }
    
    const imageBasedCount = pageResults.filter(p => p.method === 'tesseract-ocr').length;
    if (imageBasedCount > 0) {
      toast.success(`Enhanced OCR completed on ${imageBasedCount} image-based pages`, {
        position: "top-right"
      });
    }
    
    console.log("Complete OCR Results:", {
      totalPages: pageResults.length,
      totalTextLength: fullText.length,
      imageBasedPages: imageBasedCount
    });
    
    return { 
      text: fullText || "No text found in the PDF.",
      pageResults 
    };
  } catch (error) {
    console.error("OCR Error:", error);
    toast.error("Failed to extract text from PDF", {
      position: "top-right"
    });
    throw error;
  }
};

/**
 * Cleans and enhances extracted page text
 */
function cleanPageText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/\n\s*\n/g, '\n\n') // Multiple newlines to double newline
    .replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2') // Add paragraph breaks after sentences
    .replace(/([a-z])\s*([A-Z][a-z]+:)/g, '$1\n\n$2') // Add breaks before potential headings
    .trim();
}
