
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
        model: "mixtral-8x7b-32768",
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
    
    // Fallback to simple note generation with basic formatting if the API call fails
    const lines = ocrText.split('\n');
    const filteredLines = lines
      .filter(line => line.trim().length > 10)
      .map(line => `<li><strong>${line.trim().substring(0, 30)}</strong>${line.trim().substring(30)}</li>`);
    
    const fallbackNotes = `
      <h1 style="color: rgb(71, 0, 0);"><strong><u>Notes from PDF (API call failed - using fallback)</u></strong></h1>
      <ul>
        ${filteredLines.join('\n')}
      </ul>
    `;
    return { notes: fallbackNotes };
  }
};
