
import { toast } from "sonner";

export interface PageProcessingState {
  currentPage: number;
  totalPages: number;
  lastMainHeadingNumber: number;
  lastHeadingNumber: number;
  lastSubHeadingNumber: number;
  lastBulletLevel: number;
  lastNumberLevel: number;
  currentMainHeading: string;
  currentHeading: string;
  currentSubHeading: string;
  formattingContext: string;
}

export interface PageResult {
  pageNumber: number;
  formattedNotes: string;
  state: PageProcessingState;
}

/**
 * Splits OCR text into individual pages based on page markers
 */
export const splitOCRIntoPages = (ocrText: string): { pageNumber: number; content: string }[] => {
  const pages: { pageNumber: number; content: string }[] = [];
  
  // Split by page markers
  const pageRegex = /=== PAGE (\d+) OCR START ===(.*?)=== PAGE \d+ OCR END ===/gs;
  let match;
  
  while ((match = pageRegex.exec(ocrText)) !== null) {
    const pageNumber = parseInt(match[1]);
    const content = match[2].trim();
    
    if (content.length > 0) {
      pages.push({ pageNumber, content });
    }
  }
  
  console.log(`Split OCR into ${pages.length} individual pages`);
  return pages;
};

/**
 * Analyzes page content to extract current formatting state
 */
export const analyzePageForState = (pageContent: string): Partial<PageProcessingState> => {
  const state: Partial<PageProcessingState> = {};
  
  // Find main headings (Chapter, Unit, Section, Part patterns)
  const mainHeadingPatterns = [
    /(?:Chapter|Unit|Section|Part)\s+(\d+)/i,
    /^(\d+)\.\s*[A-Z][^.]*$/m,
    /^[A-Z][A-Z\s]+$/m
  ];
  
  for (const pattern of mainHeadingPatterns) {
    const match = pageContent.match(pattern);
    if (match) {
      if (match[1]) {
        state.lastMainHeadingNumber = parseInt(match[1]);
      }
      state.currentMainHeading = match[0].trim();
      break;
    }
  }
  
  // Find numbered headings (1., 2., 3., etc.)
  const headingMatches = pageContent.match(/^\d+\./gm);
  if (headingMatches) {
    const numbers = headingMatches.map(match => parseInt(match.replace('.', '')));
    state.lastHeadingNumber = Math.max(...numbers, 0);
  }
  
  // Find sub-headings (1.1, 1.2, etc.)
  const subHeadingMatches = pageContent.match(/^\d+\.\d+/gm);
  if (subHeadingMatches) {
    const numbers = subHeadingMatches.map(match => {
      const parts = match.split('.');
      return parseInt(parts[1]);
    });
    state.lastSubHeadingNumber = Math.max(...numbers, 0);
  }
  
  // Find bullet points
  const bulletMatches = pageContent.match(/^[\s]*[•\-\*]/gm);
  if (bulletMatches) {
    state.lastBulletLevel = Math.max(...bulletMatches.map(match => 
      Math.floor(match.replace(/[•\-\*]/, '').length / 2)
    ), 0);
  }
  
  return state;
};

/**
 * Creates detailed continuation context for next page processing
 */
export const createPageContinuationContext = (state: PageProcessingState): string => {
  let context = `CONTINUATION CONTEXT - Processing PAGE ${state.currentPage + 1} of ${state.totalPages}\n\n`;
  
  context += `PREVIOUS PAGE FORMATTING STATE:\n`;
  
  if (state.currentMainHeading) {
    context += `- Current main heading: "${state.currentMainHeading}"\n`;
  }
  if (state.currentHeading) {
    context += `- Current section heading: "${state.currentHeading}"\n`;
  }
  if (state.currentSubHeading) {
    context += `- Current sub-heading: "${state.currentSubHeading}"\n`;
  }
  
  context += `- Last main heading number: ${state.lastMainHeadingNumber}\n`;
  context += `- Last section heading number: ${state.lastHeadingNumber}\n`;
  context += `- Last sub-heading number: ${state.lastSubHeadingNumber}\n`;
  context += `- Last bullet point level: ${state.lastBulletLevel}\n\n`;
  
  context += `CRITICAL FORMATTING REQUIREMENTS:\n`;
  context += `1. CONTINUE EXACT numbering from previous page (do not restart from 1)\n`;
  context += `2. MAINTAIN the same heading hierarchy and HTML formatting style\n`;
  context += `3. If this page continues a section, DO NOT create new main heading\n`;
  context += `4. If this page starts genuinely new content, increment appropriately\n`;
  context += `5. PRESERVE all content - do not summarize or omit any information\n`;
  context += `6. Use IDENTICAL HTML formatting as established in previous pages\n`;
  context += `7. Continue bullet points and numbered lists seamlessly\n\n`;
  
  if (state.formattingContext) {
    context += `ESTABLISHED FORMATTING STYLE:\n${state.formattingContext}\n\n`;
  }
  
  return context;
};

/**
 * Updates formatting state after processing a page
 */
export const updateStateAfterPage = (
  previousState: PageProcessingState,
  processedNotes: string,
  pageNumber: number
): PageProcessingState => {
  const newState = { ...previousState };
  newState.currentPage = pageNumber;
  
  // Extract current headings from processed notes
  const mainHeadingMatches = processedNotes.match(/<h1[^>]*>(.*?)<\/h1>/g);
  const headingMatches = processedNotes.match(/<h2[^>]*>(.*?)<\/h2>/g);
  const subHeadingMatches = processedNotes.match(/<h3[^>]*>(.*?)<\/h3>/g);
  
  // Update current headings
  if (mainHeadingMatches && mainHeadingMatches.length > 0) {
    const lastMainHeading = mainHeadingMatches[mainHeadingMatches.length - 1];
    newState.currentMainHeading = lastMainHeading.replace(/<[^>]*>/g, '').trim();
  }
  
  if (headingMatches && headingMatches.length > 0) {
    const lastHeading = headingMatches[headingMatches.length - 1];
    newState.currentHeading = lastHeading.replace(/<[^>]*>/g, '').trim();
  }
  
  if (subHeadingMatches && subHeadingMatches.length > 0) {
    const lastSubHeading = subHeadingMatches[subHeadingMatches.length - 1];
    newState.currentSubHeading = lastSubHeading.replace(/<[^>]*>/g, '').trim();
  }
  
  // Extract formatting context from the processed notes
  const htmlSample = processedNotes.substring(0, 1000);
  newState.formattingContext = htmlSample;
  
  // Extract numbers to maintain continuity
  const extractedState = analyzePageForState(processedNotes);
  if (extractedState.lastMainHeadingNumber !== undefined) {
    newState.lastMainHeadingNumber = Math.max(newState.lastMainHeadingNumber, extractedState.lastMainHeadingNumber);
  }
  if (extractedState.lastHeadingNumber !== undefined) {
    newState.lastHeadingNumber = Math.max(newState.lastHeadingNumber, extractedState.lastHeadingNumber);
  }
  if (extractedState.lastSubHeadingNumber !== undefined) {
    newState.lastSubHeadingNumber = Math.max(newState.lastSubHeadingNumber, extractedState.lastSubHeadingNumber);
  }
  if (extractedState.lastBulletLevel !== undefined) {
    newState.lastBulletLevel = Math.max(newState.lastBulletLevel, extractedState.lastBulletLevel);
  }
  
  return newState;
};

/**
 * Merges page results into final cohesive notes
 */
export const mergePageResults = (pageResults: PageResult[]): string => {
  if (pageResults.length === 0) return '';
  if (pageResults.length === 1) return pageResults[0].formattedNotes;
  
  let mergedNotes = '';
  
  for (let i = 0; i < pageResults.length; i++) {
    const result = pageResults[i];
    
    if (i === 0) {
      // First page - include everything
      mergedNotes = result.formattedNotes;
    } else {
      // Subsequent pages - smart merging
      let pageContent = result.formattedNotes;
      
      // Remove duplicate main title if it's identical to previous
      if (i > 0) {
        const firstH1Match = pageContent.match(/<h1[^>]*>.*?<\/h1>/);
        const prevH1Match = pageResults[i-1].formattedNotes.match(/<h1[^>]*>.*?<\/h1>/);
        
        if (firstH1Match && prevH1Match && firstH1Match[0] === prevH1Match[0]) {
          pageContent = pageContent.replace(firstH1Match[0], '');
        }
      }
      
      // Clean up and add to merged notes
      pageContent = pageContent.trim();
      if (pageContent) {
        mergedNotes += '\n\n' + pageContent;
      }
    }
  }
  
  // Final cleanup and formatting
  mergedNotes = mergedNotes
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(<\/h[1-6]>)\s*(<h[1-6])/g, '$1\n\n$2')
    .replace(/(<\/p>)\s*(<[hp])/g, '$1\n\n$2')
    .replace(/(<\/[uo]l>)\s*(<[hp])/g, '$1\n\n$2')
    .trim();
  
  return mergedNotes;
};

/**
 * Processes OCR text page by page with state preservation
 */
export const processOCRPageWise = async (
  ocrText: string,
  onProgress?: (current: number, total: number, status: string) => void
): Promise<string> => {
  try {
    const pages = splitOCRIntoPages(ocrText);
    
    if (pages.length === 0) {
      throw new Error("No pages found in OCR text");
    }
    
    console.log(`Starting page-wise processing for ${pages.length} pages`);
    
    const pageResults: PageResult[] = [];
    let state: PageProcessingState = {
      currentPage: 0,
      totalPages: pages.length,
      lastMainHeadingNumber: 0,
      lastHeadingNumber: 0,
      lastSubHeadingNumber: 0,
      lastBulletLevel: 0,
      lastNumberLevel: 0,
      currentMainHeading: '',
      currentHeading: '',
      currentSubHeading: '',
      formattingContext: ''
    };
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      onProgress?.(i + 1, pages.length, `Processing PAGE ${page.pageNumber} notes...`);
      
      console.log(`Processing PAGE ${page.pageNumber} (${i + 1}/${pages.length})`);
      
      // Process this page with continuation context
      const processedNotes = await processSinglePage(page.content, page.pageNumber, state);
      
      const pageResult: PageResult = {
        pageNumber: page.pageNumber,
        formattedNotes: processedNotes,
        state: { ...state }
      };
      
      pageResults.push(pageResult);
      
      // Update state for next page
      state = updateStateAfterPage(state, processedNotes, page.pageNumber);
      
      console.log(`PAGE ${page.pageNumber} completed, state updated for continuity`);
      
      // Delay to prevent rate limiting
      if (i < pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    onProgress?.(pages.length, pages.length, "Merging all pages...");
    
    const finalNotes = mergePageResults(pageResults);
    
    console.log(`Page-wise processing completed: ${pages.length} pages merged`);
    return finalNotes;
    
  } catch (error) {
    console.error("Error in page-wise processing:", error);
    throw error;
  }
};

/**
 * Processes a single page with Groq API
 */
const processSinglePage = async (
  pageContent: string,
  pageNumber: number,
  state: PageProcessingState
): Promise<string> => {
  const GROQ_API_KEY = "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";
  const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
  
  const continuationContext = createPageContinuationContext(state);
  
  const response = await fetch(GROQ_API_URL, {
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
          content: `You are an expert note creator. Create detailed and complete HTML-formatted notes from PDF page content in simple language, as if explaining to a 7th-grade student.

${continuationContext}

RULES:
1. Use ONLY HTML formatting (no Markdown)
2. Include ALL information from this page - DO NOT omit or summarize anything
3. Use simple language (7th grade level) 
4. Break down complex concepts into easy-to-understand points
5. Wrap key terms and main concepts in <strong> tags
6. Use proper HTML structure with consistent formatting
7. Continue exact numbering and formatting from previous pages

FORMATTING REQUIREMENTS:
- Main headings: <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Title</span></span></h1>
- Section headings: <h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">Section</span></span></h2>
- Sub-headings: <h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">Sub-section</span></span></h3>
- Paragraphs: <p>Content with <strong>key terms</strong></p>

LISTS (continue numbering from previous pages):
- Bullet lists: <ul><li>Point with <strong>key terms</strong></li></ul>
- Numbered lists: <ol><li>Item with <strong>key terms</strong></li></ol>
- Nested lists supported up to 3 levels

CRITICAL: Preserve ALL content from the page. Do not compress, summarize, or skip any information.`
        },
        {
          role: "user",
          content: `Create complete and detailed HTML-formatted notes from PAGE ${pageNumber} content. Include ALL information and maintain formatting hierarchy: ${pageContent}`
        }
      ],
      temperature: 0.2,
      max_tokens: 4000,
    })
  });
  
  if (!response.ok) {
    const errorData = await response.text();
    console.error("Groq API error response:", errorData);
    throw new Error(`Groq API error: ${response.status}`);
  }
  
  const data = await response.json();
  const notes = data.choices[0].message.content;
  
  if (!notes || notes.trim().length === 0) {
    throw new Error("Empty response from Groq API");
  }
  
  return notes;
};
