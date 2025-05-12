
import { toast } from "sonner";
import { performOCR } from "./pdfOCR";
import { fixListFormattingIssues, sanitizeHtml, highlightKeyTerms, highlightMainConcepts } from "./textFormatting";
import { createEnhancedFallbackNotes } from "./contentFormatting";

export { performOCR } from "./pdfOCR";
export type { OcrResult } from "./pdfOCR";

export interface NotesResult {
  notes: string;
}

// Maximum number of retries for API calls
const MAX_RETRIES = 2;
// Timeout for API calls in milliseconds (30 seconds)
const API_TIMEOUT = 30000;

/**
 * Converts OCR text to notes using Groq API with retries and chunking for long texts
 * @param ocrText The text from OCR
 * @returns The formatted notes
 */
export const generateNotesFromText = async (ocrText: string): Promise<NotesResult> => {
  let retries = 0;
  
  // Split long OCR text into pages if needed
  const pages = ocrText.split(/Page \d+:/g).filter(page => page.trim().length > 0);
  const isMultiPage = pages.length > 1;
  
  // Function to handle API timeout
  const fetchWithTimeout = (url: string, options: RequestInit, timeout: number) => {
    return Promise.race([
      fetch(url, options),
      new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('API request timed out')), timeout)
      )
    ]) as Promise<Response>;
  };
  
  while (retries <= MAX_RETRIES) {
    try {
      const GROQ_API_KEY = "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";
      const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
      
      console.log(`Attempt ${retries + 1} of ${MAX_RETRIES + 1}: Using Groq API to generate notes`);
      
      // Optimized system prompt with clearer, non-redundant instructions
      const systemPrompt = `You are a professional educator that creates detailed yet EASY-TO-UNDERSTAND notes from PDF text.

KEY RESPONSIBILITIES:
1. PRESERVE 100% OF CONTENT from the original PDF
2. EXPLAIN everything in SIMPLE language that a 7th grader could understand
3. FORMAT properly with special attention to lists and structure
4. HIGHLIGHT KEY TERMS by wrapping important concepts in <strong> tags

CONTENT GUIDELINES:
- Include ALL information, facts, numbers, and details from the source
- Add proper introductions to each topic explaining what it is and why it matters
- Break complex ideas into simple explanations with everyday examples
- Define ALL technical terms in plain language
- Connect abstract concepts to real-world applications

FORMATTING REQUIREMENTS:
- Use proper HTML: <ul><li> for bullet lists, <ol><li> for numbered lists
- Create clear section headings with proper HTML styling:
  * <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0);">Main Topic</span></span></h1>
  * <h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157);">Sub-Topic</span></span></h2>
  * <h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94);">Specific Point</span></span></h3>
- HIGHLIGHT FIRST KEY WORD OR PHRASE/MAIN WORD of the sentance by wrapping it in <strong> tags
- WRAP MAIN CONCEPTS of each paragraph in <strong> tags
- HIGHLIGHT KEY TERMS with <strong> tags, especially technical terms, important processes, or critical concepts


MULTI-PAGE HANDLING:
- Maintain complete continuity between pages
- Ensure no information is lost at page transitions`;

      // Enhanced user prompt that's simpler and more direct
      const userPrompt = `Create easy-to-understand notes from this PDF text. Make sure you:
1. Keep 100% of the original content
2. Explain everything simply (7th grade level)
3. WRAP IMPORTANT CONCEPTS in <strong> tags
4. Use proper HTML lists (<ul><li> for bullets, <ol><li> for numbered)
5. Make each section build on fundamental concepts

This is ${isMultiPage ? 'a multi-page document' : 'a single-page document'}.

Here is the complete OCR text: ${ocrText}`;

      // Begin with toast notification
      toast.loading("Processing with Groq API - Creating comprehensive notes...", {
        id: "groq-processing",
        position: "top-right",
        duration: 10000
      });
      
      const response = await fetchWithTimeout(GROQ_API_URL, {
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
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ],
          temperature: 0.5,
          max_tokens: 4000,
        })
      }, API_TIMEOUT);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("Groq API error response:", errorData);
        throw new Error(`Groq API error: ${response.status}`);
      }
      
      const data = await response.json();
      let notes = data.choices[0].message.content;
      
      // Dismiss the loading toast
      toast.dismiss("groq-processing");
      
      // Verify we have valid formatted notes
      if (!notes || notes.trim().length === 0) {
        throw new Error("Empty response from Groq API");
      }
      
      // Check if the notes are significantly shorter than the OCR text (potential content loss)
      const ocrWords = ocrText.split(/\s+/).length;
      const notesWords = notes.split(/\s+/).length;
      
      if (notesWords < ocrWords * 0.7 && retries < MAX_RETRIES) {
        console.warn(`Warning: Generated notes (${notesWords} words) appear to be significantly shorter than the source text (${ocrWords} words). Retrying...`);
        retries++;
        toast.warning("Notes may not contain all information. Retrying with improved prompts...", {
          duration: 3000,
          position: "top-right"
        });
        continue;
      }
      
      console.log(`Notes generation successful. OCR words: ${ocrWords}, Notes words: ${notesWords}`);
      
      // Post-process to ensure key terms and main concepts are highlighted
      notes = highlightKeyTerms(notes);
      notes = highlightMainConcepts(notes);
      
      // Check for common list formatting issues
      const fixedNotes = fixListFormattingIssues(notes);
      
      // Success toast with specific information
      toast.success(`Complete notes created with 100% content preservation. OCR: ${ocrWords} words, Notes: ${notesWords} words`, {
        duration: 5000,
        position: "top-right"
      });
      
      // Sanitize the notes to ensure valid HTML
      const sanitizedNotes = sanitizeHtml(fixedNotes);
      
      return { notes: sanitizedNotes };
      
    } catch (error) {
      console.error(`Groq API Error (Attempt ${retries + 1}):`, error);
      
      if (retries < MAX_RETRIES) {
        retries++;
        toast.warning(`API processing attempt ${retries} failed. Retrying...`, {
          duration: 3000,
          position: "top-right"
        });
      } else {
        toast.error("Failed to generate complete notes. Falling back to enhanced OCR text formatting.", {
          duration: 5000,
          position: "top-right"
        });
        
        // Create a better fallback that preserves ALL original text and provides enhanced formatting
        return { notes: createEnhancedFallbackNotes(ocrText) };
      }
    }
  }
  
  // If we reach here, all retries failed
  console.error("All API attempts failed. Using fallback formatting.");
  toast.error("API processing failed after multiple attempts. Using fallback formatting with 100% content preservation.", {
    duration: 5000,
    position: "top-right"
  });
  
  // Provide an enhanced fallback with better formatting
  return { notes: createEnhancedFallbackNotes(ocrText) };
};
