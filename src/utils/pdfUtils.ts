
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
        model: "meta-llama/llama-4-scout-17b-16e-instruct", // Keep current model
        messages: [
          {
            role: "system",
            content: `You are a professional note organizer that creates beautifully formatted, comprehensive notes from PDF text. 
            Your task is to reorganize and format the content following these guidelines:
            
            - DO NOT SKIP ANY CONTENT OR INFORMATION from the original PDF text
            - Include ALL information from the original text, preserving all facts, numbers, terminology, and examples
            - Organize content logically with proper hierarchy, proper sequence and proper relationship between headings, sub-headings and concepts
            - Explain concepts in simple, easy-to-understand language while maintaining complete accuracy
            - Define technical terms or jargon when they first appear
            - Expand abbreviations and acronyms at first use
            - Break down complex concepts into digestible parts
            - Break long sentences into multiple short sentences
            - Wrap main concepts of each sentence in <strong> tags
            - Use clear section headings with proper HTML styling:
              * Main headings: <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Main Heading</span></span></h1>
              * Secondary headings: <h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">Secondary Heading</span></span></h2>
              * Tertiary headings: <h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">Tertiary Heading</span></span></h3>
            - Use bullet points (<ul><li>) for listing items or steps
            - Use ordered lists (<ol><li>) for sequential steps or numbered items
            - Create tables using <table>, <tbody>, <tr>, <td> tags for any comparative information
            - Include relevant examples to illustrate difficult concepts
            - Provide additional clarifications in brackets where helpful [like this]
            - Maintain the same level of detail as the original text but make it easier to understand
            - Make sure all HTML tags are properly closed and nested correctly
            - Ensure line breaks after headings and list items for better readability
            - Separate sentences with proper line breaks where it makes sense for readability
            - Ensure that your output is valid HTML that can be rendered correctly in a rich text editor
            
            Your output should be complete, detailed HTML that preserves ALL the original content while making it more structured and easier to understand.`
          },
          {
            role: "user",
            content: `Create detailed, comprehensive, and easy-to-understand notes from this PDF text, following all the formatting guidelines in your instructions. DO NOT SKIP ANY INFORMATION: ${ocrText}`
          }
        ],
        temperature: 0.2,
        // No max_tokens limit to ensure full output of detailed notes
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Groq API error response:", errorData);
      throw new Error(`Groq API error: ${response.status}`);
    }
    
    const data = await response.json();
    const notes = data.choices[0].message.content;
    
    // Verify we have valid formatted notes
    if (!notes || notes.trim().length === 0) {
      throw new Error("Empty response from Groq API");
    }
    
    // Sanitize the notes to ensure valid HTML
    const sanitizedNotes = sanitizeHtml(notes);
    
    return { notes: sanitizedNotes };
    
  } catch (error) {
    console.error("Groq API Error:", error);
    toast.error("Failed to generate notes from text");
    
    // Create a better fallback with proper HTML formatting when API fails
    const createFormattedNotes = (text: string) => {
      // Extract pages
      const pages = text.split('\n\n').filter(page => page.trim().startsWith('Page'));
      
      let formattedHtml = `
        <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Complete Text from PDF (API call failed - using fallback)</span></span></h1>
        <p>Below is the complete text extracted from your PDF, with minimal formatting since the note generation service couldn't be reached.</p>
      `;
      
      // Process each page
      pages.forEach(page => {
        const pageLines = page.split('\n');
        const pageTitle = pageLines[0].trim();
        const pageContent = pageLines.slice(1).join(' ').trim();
        
        // Add page title as h2
        formattedHtml += `
          <h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">${pageTitle}</span></span></h2>
        `;
        
        // Break content into paragraphs for better readability
        const paragraphs = pageContent.split(/(?:\.|\?|\!)(?:\s+|\n)/g).filter(p => p.trim().length > 0);
        
        if (paragraphs.length > 0) {
          paragraphs.forEach(paragraph => {
            if (paragraph.trim().length > 0) {
              // Identify potential key terms with capitalized words and wrap main concepts in strong tags
              const processed = paragraph
                .replace(/\b([A-Z][a-z]{2,}|[A-Z]{2,})\b/g, '<strong>$1</strong>')
                .trim();
                
              formattedHtml += `<p>${processed}.</p>\n`;
            }
          });
        } else {
          // If no paragraphs were detected, just output the raw content
          formattedHtml += `<p>${pageContent}</p>\n`;
        }
      });
      
      return formattedHtml;
    };
    
    return { notes: createFormattedNotes(ocrText) };
  }
};

/**
 * Helper function to sanitize HTML and ensure it's valid for TinyMCE
 */
function sanitizeHtml(html: string): string {
  // Apply formatting similar to the provided template logic
  let sanitized = html
    // Ensure proper line breaks after closing tags for better readability
    .replace(/<\/(h[1-3])>/g, '</$1>\n\n')
    .replace(/<\/(ul|ol)>/g, '</$1>\n')
    
    // Fix spacing issues and ensure proper paragraph breaks
    .replace(/>\s+</g, '>\n<')
    
    // Fix nested lists by ensuring proper closing tags
    .replace(/<\/li><li>/g, '</li>\n<li>')
    .replace(/<\/li><\/ul>/g, '</li>\n</ul>')
    .replace(/<\/li><\/ol>/g, '</li>\n</ol>')
    
    // Fix potential unclosed strong tags
    .replace(/<strong>([^<]*)<strong>/g, '<strong>$1</strong>')
    
    // Fix nested strong tags
    .replace(/<strong>([^<]*)<strong>([^<]*)<\/strong>([^<]*)<\/strong>/g, '<strong>$1$2$3</strong>')
    
    // Make sure headings have both opening and closing tags
    .replace(/<h([1-6])([^>]*)>([^<]*)/gi, (match, level, attrs, content) => {
      if (!content.trim()) return match;
      return `<h${level}${attrs}>${content}`;
    })
    
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +/g, ' ')
    
    // Ensure each paragraph has proper spacing
    .replace(/<p>/g, '\n<p>')
    .replace(/<\/p>/g, '</p>\n')
    
    // Clean up bullet points for consistent formatting
    .replace(/<ul><li>/g, '\n<ul>\n<li>')
    .replace(/<\/li><\/ul>/g, '</li>\n</ul>\n')
    
    // Clean up ordered lists for consistent formatting
    .replace(/<ol><li>/g, '\n<ol>\n<li>')
    .replace(/<\/li><\/ol>/g, '</li>\n</ol>\n')
    
    // Ensure headings are properly formatted according to the template
    .replace(/<h1>([^<]+)<\/h1>/g, '<h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">$1</span></span></h1>')
    .replace(/<h2>([^<]+)<\/h2>/g, '<h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">$1</span></span></h2>')
    .replace(/<h3>([^<]+)<\/h3>/g, '<h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">$1</span></span></h3>')
    
    // Fix any double-decorated headings
    .replace(/<h([1-3])><span style="text-decoration: underline;"><span style="color: rgb\([^)]+\); text-decoration: underline;">(<span style="text-decoration: underline;"><span style="color: rgb\([^)]+\); text-decoration: underline;">[^<]+<\/span><\/span>)<\/span><\/span><\/h\1>/g, 
             '<h$1>$2</h$1>');

  return sanitized;
}
