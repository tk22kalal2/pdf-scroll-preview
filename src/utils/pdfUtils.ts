
import { toast } from "sonner";

export interface OcrResult {
  text: string;
}

export interface NotesResult {
  notes: string;
}

/**
 * Performs OCR on PDF pages
 * @param file The PDF file
 * @param pageNumbers Array of page numbers to process
 * @returns The OCR result
 */
export const performOCR = async (file: File, pageNumbers: number[]): Promise<OcrResult> => {
  try {
    // In a real implementation, this would call an OCR service
    // For now, we'll extract text from the PDF using PDF.js
    const pdfjs = await import('pdfjs-dist');
    const pdfjsLib = pdfjs;
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    
    let fullText = '';
    
    for (const pageNum of pageNumbers) {
      if (pageNum > pdf.numPages || pageNum < 1) continue;
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      fullText += `Page ${pageNum}:\n${pageText}\n\n`;
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
        model: "llama3-70b-8192", // Updated model that is supported
        messages: [
          {
            role: "system",
            content: `You are a professional note organizer that creates beautifully formatted, structured notes from PDF text. 
            Your task is to reorganize and format the content following these guidelines:
            
            - Organize content logically with proper hierarchy, proper sequence and proper relationship between headings, sub-headings and concepts.
            - Use clear section headings with proper HTML styling:
              * Main headings: <h1 style="color: rgb(71, 0, 0);"><strong><u>Main Heading</u></strong></h1>
              * Secondary headings: <h2 style="color: rgb(26, 1, 157);"><strong><u>Secondary Heading</u></strong></h2>
              * Tertiary headings: <h3 style="color: rgb(52, 73, 94);"><strong><u>Tertiary Heading</u></strong></h3>
            - Break down complex concepts into digestible parts
            - Break long sentences into multiple short sentences
            - Use bullet points (<ul> and <li>) for better readability
            - Highlight key terms with <strong> tags
            - Wrap main concepts of each sentence in <strong> tags
            - Don't skip any information from the original content
            - If there are comparisons or differences, create a table using <table>, <tbody>, <tr>, <td> tags
            - Explain difficult terms in simpler language using brackets
            - Use examples where they help clarify concepts
            - Include all relevant details, dates, numbers, and specific information
            
            Your output should be complete HTML that renders properly in a rich text editor.`
          },
          {
            role: "user",
            content: `Create professionally formatted notes from this PDF text, following all the formatting guidelines in your instructions: ${ocrText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Groq API error response:", errorData);
      throw new Error(`Groq API error: ${response.status}`);
    }
    
    const data = await response.json();
    const notes = data.choices[0].message.content;
    
    return { notes };
    
  } catch (error) {
    console.error("Groq API Error:", error);
    toast.error("Failed to generate notes from text");
    
    // Create a better fallback with proper HTML formatting when API fails
    const createFormattedNotes = (text: string) => {
      // Extract pages
      const pages = text.split('\n\n').filter(page => page.trim().startsWith('Page'));
      
      let formattedHtml = `
        <h1 style="color: rgb(71, 0, 0);"><strong><u>Notes from PDF (API call failed - using fallback)</u></strong></h1>
      `;
      
      // Process each page
      pages.forEach(page => {
        const pageLines = page.split('\n');
        const pageTitle = pageLines[0].trim();
        const pageContent = pageLines.slice(1).join(' ').trim();
        
        // Add page title as h2
        formattedHtml += `
          <h2 style="color: rgb(26, 1, 157);"><strong><u>${pageTitle}</u></strong></h2>
        `;
        
        // Process content - attempt to identify key concepts
        const sentences = pageContent.split('. ').filter(s => s.trim().length > 0);
        
        formattedHtml += `<ul>`;
        sentences.forEach(sentence => {
          // Identify potential key terms with capitalized words or terms surrounded by special characters
          const processed = sentence.replace(/\b([A-Z][a-z]+|[A-Z]{2,})\b/g, '<strong>$1</strong>')
                                   .replace(/·([^·]+)/g, '• <strong>$1</strong>');
                                   
          formattedHtml += `<li>${processed}</li>`;
        });
        formattedHtml += `</ul>`;
      });
      
      return formattedHtml;
    };
    
    return { notes: createFormattedNotes(ocrText) };
  }
};
