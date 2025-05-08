
import * as Tesseract from 'tesseract.js';
import { toast } from 'sonner';

export async function performOCR(file: File, pageNumbers: number[]): Promise<{ text: string, confidence: number }> {
  try {
    if (!file || pageNumbers.length === 0) {
      throw new Error('Invalid file or page numbers');
    }

    // Show toast message for OCR process
    toast.loading(`Starting OCR extraction for ${pageNumbers.length} pages...`, {
      id: 'ocr-process',
    });

    // Use PDF.js to render the specified pages to canvases
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    
    let fullText = '';
    let totalConfidence = 0;
    let processedPages = 0;

    // Process each page
    for (const pageNum of pageNumbers) {
      if (pageNum < 1 || pageNum > pdf.numPages) continue;

      // Update toast with progress
      toast.loading(`OCR processing page ${pageNum} of ${pdf.numPages}...`, {
        id: 'ocr-process',
      });

      // Render PDF page to canvas
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      if (!context) {
        throw new Error('Could not create canvas context');
      }

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Perform OCR on the rendered canvas
      const { data } = await Tesseract.recognize(canvas, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            toast.loading(`Page ${pageNum}: OCR ${Math.round(m.progress * 100)}% complete...`, {
              id: 'ocr-process',
            });
          }
        }
      });

      fullText += `\n\n== Page ${pageNum} ==\n\n${data.text}`;
      totalConfidence += data.confidence;
      processedPages++;
    }

    const averageConfidence = processedPages > 0 ? totalConfidence / processedPages : 0;
    
    toast.success(`OCR completed with ${Math.round(averageConfidence)}% average confidence`, {
      id: 'ocr-process',
    });

    return { 
      text: fullText.trim(), 
      confidence: averageConfidence 
    };
  } catch (error) {
    console.error('OCR error:', error);
    toast.error('OCR extraction failed. Please try again.', {
      id: 'ocr-process',
    });
    
    throw new Error('OCR process failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// Function to format the Groq response with proper styling
function formatGroqResponse(text: string) {
  const lines = text.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings
    if (/^### /.test(line)) {
      result.push('<h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">' + line.slice(4) + '</span></span></h3>');
    } else if (/^## /.test(line)) {
      result.push('<h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">' + line.slice(3) + '</span></span></h2>');
    } else if (/^# /.test(line)) {
      result.push('<h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">' + line.slice(2) + '</span></span></h1>');

    // Ordered list (1. Step)
    } else if (/^\d+\.\s+/.test(line)) {
      result.push('<ol><li>' + line.replace(/^\d+\.\s+/, '') + '</li></ol>');

    // Third-level bullet (4+ spaces or tab)
    } else if (/^(\s{4,}|\t{2,})[\-\+\*] /.test(line)) {
      result.push('<ul><ul><ul><li>' + line.replace(/^(\s{4,}|\t{2,})[\-\+\*] /, '') + '</li></ul></ul></ul>');

    // Second-level bullet (2+ spaces or 1 tab)
    } else if (/^(\s{2}|\t)[\-\+\*] /.test(line)) {
      result.push('<ul><ul><li>' + line.replace(/^(\s{2}|\t)[\-\+\*] /, '') + '</li></ul></ul>');

    // First-level bullet
    } else if (/^[\-\+\*] /.test(line)) {
      result.push('<ul><li>' + line.slice(2) + '</li></ul>');

    // Plain text
    } else {
      result.push(line);
    }
  }

  return result.join('\n')
    // Format bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Line spacing after tags
    .replace(/<\/(h[1-3]|ul|ol)>/g, '</$1>\n')
    // Sentence breaks
    .replace(/([.!?])\s*(?=[A-Z])/g, '$1\n')
    // Extra spacing cleanup
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +/g, ' ')
    .trim() + '\n'.repeat(10);
}

// Function to sanitize HTML to prevent XSS and ensure consistency
function sanitizeHtml(html: string): string {
  // A simple sanitizer - for complex applications use DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '') // Remove inline JS events
    .replace(/javascript:/gi, '')
    // Format common elements
    .replace(/<(\/?)h1>/gi, '<$1h1>')
    .replace(/<(\/?)h2>/gi, '<$1h2>')
    .replace(/<(\/?)h3>/gi, '<$1h3>')
    .replace(/<(\/?)p>/gi, '<$1p>')
    .replace(/<(\/?)ul>/gi, '<$1ul>')
    .replace(/<(\/?)ol>/gi, '<$1ol>')
    .replace(/<(\/?)li>/gi, '<$1li>')
    .replace(/<(\/?)strong>/gi, '<$1strong>')
    // Add spacing for paragraphs
    .replace(/<\/p><p>/g, '</p>\n<p>')
    // Clean up any excessive newlines
    .replace(/\n{3,}/g, '\n\n');
}

export async function generateNotesFromText(text: string): Promise<{ notes: string }> {
  try {
    // Prepare the prompt for Groq API
    const prompt = `
You are an AI that generates comprehensive, structured notes from OCR-extracted PDF text. Below is the raw OCR text:

${text.substring(0, 15000)}

Please thoroughly analyze this text and create detailed, well-formatted notes with the following:

1. Use Markdown headings (# for main sections, ## for subsections, ### for minor sections)
2. Use bullet points (-, +, or *) for listing related concepts
3. Create ordered lists (1., 2., etc.) for sequential steps or processes
4. Organize content logically by topic
5. Wrap main concepts of each sentence in <strong> tags
6. Highlight key terms, definitions, and important facts
7. Include ALL important information without omissions
8. Do not generate content not found in the source text
9. Preserve the exact information content without summarizing or reducing detail

Format your response as comprehensive academic notes that follow the exact structure and content of the source material.
`;

    // Send to Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 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',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        // No max_tokens limit to allow for detailed notes
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response from API');
    }
    
    // Get the generated notes from the API response
    const generatedNotes = data.choices[0].message.content;
    
    // Format and clean the notes
    const formattedNotes = formatGroqResponse(generatedNotes);
    const sanitizedNotes = sanitizeHtml(formattedNotes);
    
    return { notes: sanitizedNotes };
    
  } catch (error) {
    console.error('Notes generation error:', error);
    // Fallback to simpler formatting if there's an error
    const fallbackNotes = `
      <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">PDF Notes</span></span></h1>
      <p>Unfortunately, there was an error generating structured notes. Below is the raw extracted text:</p>
      <p>${text.substring(0, 5000)}</p>
      <p>Error details: ${error instanceof Error ? error.message : String(error)}</p>
    `;
    
    return { notes: fallbackNotes };
  }
}
