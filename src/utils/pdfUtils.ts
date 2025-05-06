
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
        model: "mixtral-8x7b-32768",  // Changed to a model that exists on Groq
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that creates concise, organized notes from PDF text. Format your response with clear headings, bullet points, and numbered lists where appropriate."
          },
          {
            role: "user",
            content: `Create organized, concise notes from this PDF text: ${ocrText}`
          }
        ],
        temperature: 0.5,
        max_tokens: 2048
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
    
    // Fallback to simple note generation if the API call fails
    const lines = ocrText.split('\n');
    const filteredLines = lines
      .filter(line => line.trim().length > 10)
      .map(line => `• ${line.trim()}`);
    
    const fallbackNotes = `Notes from PDF (API call failed - using fallback):\n\n${filteredLines.join('\n')}`;
    return { notes: fallbackNotes };
  }
};
