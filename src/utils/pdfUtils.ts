
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
    
    // Show informative toast about the process
    toast.loading("Creating notes with easy-to-understand explanations while preserving 100% of content...", {
      duration: 10000,
      position: "top-right"
    });
    
    // Create a more robust request with proper error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2-minute timeout
    
    try {
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
              content: `You are a professional educator and note organizer that MUST create BOTH complete AND easy-to-understand notes from PDF text.

YOUR PRIMARY RESPONSIBILITIES ARE:
1. PRESERVE 100% OF THE INFORMATIONAL CONTENT from the original PDF
2. EXPLAIN everything in the SIMPLEST possible language with proper context

Follow these critical guidelines:

CONTENT PRESERVATION:
- INCLUDE ABSOLUTELY ALL INFORMATION from the original PDF text - DO NOT OMIT ANYTHING
- Preserve every fact, number, terminology, example, and detail from the original text
- If unsure about something, include it anyway - better to include everything than miss important information

MAKING CONTENT EASIER TO UNDERSTAND:
- ALWAYS add a proper introduction to the topic that explains what it is and why it matters
- Connect each concept to basic fundamentals that a beginner would understand
- Break complex ideas into simple explanations with everyday analogies
- Define ALL technical terms or jargon in simple language
- Expand abbreviations and acronyms and explain what they mean
- Break long sentences into multiple short ones for better readability
- Use very simple vocabulary that a 7th grade student could understand
- Add helpful examples for difficult concepts
- Relate abstract concepts to real-world applications whenever possible
- Use cause-and-effect explanations to show relationships between ideas

FORMATTING FOR CLARITY:
- Organize content logically with clear hierarchy
- Use proper HTML formatting to enhance readability
- Wrap main concepts of each paragraph in <strong> tags
- Use bullet points (<ul><li>) with proper spacing between points for clarity
- Use numbered lists (<ol><li>) for sequential steps or processes
- Create tables (<table> tags) for comparative information
- Use clear section headings with proper HTML styling:
  * Main headings: <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Main Topic</span></span></h1>
  * Secondary headings: <h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">Sub-Topic</span></span></h2>
  * Tertiary headings: <h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">Specific Point</span></span></h3>
- Ensure all HTML tags are properly closed and nested
- Add proper spacing between sections for visual organization
- Create a logical flow from basic to advanced concepts

REMEMBER: Your output MUST contain 100% of the information from the input text, reorganized into an easy-to-understand format with proper introductions, context, and explanations that connect each concept to its basics.`
            },
            {
              role: "user",
              content: `Create detailed, comprehensive AND easy-to-understand notes from this PDF text, following ALL guidelines. Remember to: 
1. Preserve 100% of the original content 
2. Add proper introductions to each topic
3. Connect each concept to its basics
4. Explain everything in the simplest possible language
5. Include helpful examples and real-world applications

Here is the complete OCR text: ${ocrText}`
            }
          ],
          temperature: 0.7, // Adjusted for better balance between creativity and precision
          max_tokens: 12000,  // Increased token limit for complete coverage
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq API error response:", errorText);
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Invalid response structure from Groq API:", data);
        throw new Error("Invalid API response format");
      }
      
      const notes = data.choices[0].message.content;
      
      // Verify we have valid formatted notes
      if (!notes || notes.trim().length === 0) {
        throw new Error("Empty response from Groq API");
      }
      
      // Check if the notes are significantly shorter than the OCR text (potential content loss)
      if (notes.length < ocrText.length * 0.7) {
        console.warn("Warning: Generated notes appear to be significantly shorter than the source text");
        toast.warning("The generated notes may be shorter than expected. Please check the raw OCR text to verify all content was included.", {
          duration: 5000,
          position: "top-right"
        });
      } else {
        toast.success("Complete notes generated with beginner-friendly explanations", {
          duration: 4000,
          position: "top-right"
        });
      }
      
      // Sanitize the notes to ensure valid HTML
      const sanitizedNotes = sanitizeHtml(notes);
      
      return { notes: sanitizedNotes };
    } catch (fetchError: any) {
      // Handle specific fetch errors
      console.error("Groq API Fetch Error:", fetchError);
      
      if (fetchError.name === 'AbortError') {
        throw new Error("Request timed out. The API took too long to respond.");
      }
      
      // Try a second attempt with reduced token count if the first failed
      try {
        console.log("First attempt failed, trying again with reduced parameters...");
        toast.loading("First attempt failed, retrying with optimized settings...", {
          duration: 5000,
          position: "top-right"
        });
        
        const retryResponse = await fetch(GROQ_API_URL, {
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
                content: "Create easy-to-understand notes from the PDF text. Make sure to preserve ALL information, explain concepts clearly, and format the output nicely with HTML formatting."
              },
              {
                role: "user",
                content: `Create easy-to-understand notes from this PDF text, including ALL information: ${ocrText}`
              }
            ],
            temperature: 0.5,
            max_tokens: 8000,
          })
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Retry failed with status: ${retryResponse.status}`);
        }
        
        const retryData = await retryResponse.json();
        const retryNotes = retryData.choices[0].message.content;
        
        if (!retryNotes || retryNotes.trim().length === 0) {
          throw new Error("Empty response from retry attempt");
        }
        
        // Check if the retry notes contain enough content
        if (retryNotes.length < ocrText.length * 0.6) {
          throw new Error("Retry produced incomplete notes");
        }
        
        toast.success("Notes generated with simpler formatting", {
          duration: 4000,
          position: "top-right"
        });
        
        return { notes: sanitizeHtml(retryNotes) };
      } catch (retryError) {
        console.error("Retry also failed:", retryError);
        throw fetchError; // Throw the original error to trigger fallback
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Groq API Error:", error);
    
    // Show a more informative error message
    toast.error("Failed to process notes with Groq API. Creating formatted version of all OCR text.", {
      duration: 5000,
      position: "top-right"
    });
    
    // Create a better fallback that preserves ALL original text
    const createFormattedNotes = (text: string) => {
      // Start with a header explaining this is fallback formatting
      let formattedHtml = `
        <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Complete PDF Content (Original Format)</span></span></h1>
        <p>Below is the <strong>complete text</strong> extracted from your PDF with basic formatting. All original information has been preserved.</p>
      `;
      
      // Extract pages and preserve ALL content
      const pages = text.split('\n\n').filter(page => page.trim().startsWith('Page'));
      
      // If no pages were found, just format the entire text
      if (pages.length === 0) {
        const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
        
        paragraphs.forEach(paragraph => {
          if (paragraph.trim().length > 0) {
            // Apply basic formatting to enhance readability even in the fallback
            const enhancedParagraph = paragraph
              .replace(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*):/, '<strong>$1:</strong>')
              .replace(/\b([A-Z]{2,})\b/g, '<strong>$1</strong>')
              .replace(/\b([A-Z][a-z]{2,})\b/g, '<em>$1</em>');
            
            formattedHtml += `<p>${enhancedParagraph.trim()}</p>\n`;
          }
        });
        
        return formattedHtml;
      }
      
      // Process each page to preserve ALL content
      pages.forEach(page => {
        const pageLines = page.split('\n');
        const pageTitle = pageLines[0].trim();
        // Join all remaining lines to ensure no content is lost
        const pageContent = pageLines.slice(1).join(' ').trim();
        
        // Add page title as h2
        formattedHtml += `
          <h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">${pageTitle}</span></span></h2>
        `;
        
        // Improve formatting by detecting potential sections in the original text
        const sections = pageContent.split(/(?:\.\s+)(?=[A-Z][a-z]+(?:\s[A-Z][a-z]+)*:)/);
        
        sections.forEach(section => {
          // Look for patterns that might indicate section headers
          const headerMatch = section.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*):(.*)$/);
          
          if (headerMatch) {
            const [_, header, content] = headerMatch;
            formattedHtml += `<h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">${header}</span></span></h3>\n`;
            
            // Process the content after the header
            if (content.trim().length > 0) {
              // Attempt to detect list patterns and format them
              if (content.includes("• ") || content.includes("* ") || 
                  /\d+\.\s+[A-Z]/.test(content) || 
                  /(?:\.\s+|^)(?:\(?\d+\)?\.?\s+|\-\s+|\•\s+)/.test(content)) {
                
                // Attempt to split into list items
                const listItems = content.split(/(?:\.\s+|^)(?:\(?\d+\)?\.?\s+|\-\s+|\•\s+)/)
                  .filter(item => item.trim().length > 0);
                
                if (listItems.length > 1) {
                  formattedHtml += '<ul>\n';
                  listItems.forEach(item => {
                    if (item.trim().length > 0) {
                      formattedHtml += `<li>${item.trim()}</li>\n`;
                    }
                  });
                  formattedHtml += '</ul>\n';
                } else {
                  formattedHtml += `<p>${content.trim()}</p>\n`;
                }
              } else {
                formattedHtml += `<p>${content.trim()}</p>\n`;
              }
            }
          } else {
            // No header, just paragraph text
            if (section.trim().length > 0) {
              // Apply basic formatting to enhance readability
              const enhancedSection = section
                .replace(/\b([A-Z]{2,})\b/g, '<strong>$1</strong>')
                .replace(/\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]+){1,3})\b/g, '<strong>$1</strong>');
              
              formattedHtml += `<p>${enhancedSection.trim()}</p>\n`;
            }
          }
        });
      });
      
      formattedHtml += `
        <p><strong>Note:</strong> This content has been formatted in a basic way to preserve all original information. To transform this into more easily understandable notes, you can use the Chat feature to ask questions or request explanations of specific concepts.</p>
      `;
      
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
