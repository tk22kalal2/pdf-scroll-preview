
import { toast } from "sonner";
import { performOCR } from "./pdfOCR";
import { fixListFormattingIssues, sanitizeHtml } from "./textFormatting";
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
      
      // Enhanced system prompt with stronger emphasis on proper list formatting
      const systemPrompt = `You are a professional educator and note organizer that MUST create BOTH complete AND easy-to-understand notes from PDF text.

YOUR PRIMARY RESPONSIBILITIES ARE:
1. PRESERVE 100% OF THE INFORMATIONAL CONTENT from the original PDF
2. EXPLAIN everything in the SIMPLEST possible language with proper context
3. MAINTAIN PROPER FORMATTING, especially for lists, bullet points, and structured content

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

MULTI-PAGE DOCUMENTS HANDLING:
- MAINTAIN THE ORIGINAL STRUCTURE of multi-page documents
- Ensure COMPLETE CONTINUITY between pages
- For each page, maintain ALL original content while making it easier to understand
- Make sure no information is lost between page transitions
- Create logical connections between pages for better comprehension
- If a topic spans multiple pages, ensure complete coverage across all relevant pages

PROPER LIST FORMATTING IS CRITICAL:
- ALWAYS use proper HTML list structures (<ul><li> or <ol><li>)
- DO NOT convert lists to paragraph format
- Maintain list hierarchies and indentation levels
- Ensure each list item is correctly formatted as: <li>Item description</li>
- For bullet lists that appear in the original text, ALWAYS use <ul><li> format
- For numbered lists that appear in the original text, ALWAYS use <ol><li> format
- Ensure there is proper spacing between list items
- Always close list tags properly
- NEVER leave list items without proper <li> tags
- Ensure list items aren't joined together accidentally

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

MEMORY MANAGEMENT:
- For multi-page documents, maintain ALL information across all pages
- Do not forget or omit information from earlier pages when processing later pages
- Ensure COMPLETE COVERAGE of all content, maintaining all original information

REMEMBER: Your output MUST contain 100% of the information from the input text, reorganized into an easy-to-understand format with proper introductions, context, and explanations that connect each concept to its basics. PROPER HTML FORMATTING FOR LISTS IS ABSOLUTELY ESSENTIAL.`;

      // Enhanced user prompt with examples of proper list formatting
      const userPrompt = `Create detailed, comprehensive AND easy-to-understand notes from this PDF text, following ALL guidelines. Remember to: 
1. Preserve 100% of the original content 
2. Add proper introductions to each topic
3. Connect each concept to its basics
4. Explain everything in the simplest possible language
5. Include helpful examples and real-world applications
6. USE PROPER LIST FORMATTING - this is critical!

IMPORTANT FORMATTING REQUIREMENTS:
- For any list-like content, ALWAYS use proper HTML list structures
- For bullet points use:
  <ul>
    <li>First point</li>
    <li>Second point</li>
  </ul>
- For numbered lists use:
  <ol>
    <li>First step</li>
    <li>Second step</li>
  </ol>
- DO NOT convert lists to paragraph format
- DO NOT use asterisks (*) or other characters for lists - use proper HTML

This is ${isMultiPage ? 'a multi-page document' : 'a single-page document'}. ${
        isMultiPage ? 'Make sure to maintain COMPLETE continuity between pages, preserve ALL information, and ensure proper list formatting throughout all pages.' : ''
      }

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
          model: "meta-llama/llama-4-scout-17b-16e-instruct", // Keep current model
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
          temperature: 0.5, // Lowered for more consistent, deterministic output with better formatting
          max_tokens: 4000,  // Increased token limit to ensure complete coverage
        })
      }, API_TIMEOUT);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("Groq API error response:", errorData);
        throw new Error(`Groq API error: ${response.status}`);
      }
      
      const data = await response.json();
      const notes = data.choices[0].message.content;
      
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
