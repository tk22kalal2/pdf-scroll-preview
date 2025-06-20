
import { toast } from "sonner";

export interface ChunkProcessingState {
  lastMainHeadingNumber: number;
  lastHeadingNumber: number;
  lastSubHeadingNumber: number;
  lastBulletLevel: number;
  lastNumberLevel: number;
  currentMainHeading: string;
  currentHeading: string;
  currentSubHeading: string;
  processedChunks: number;
  totalChunks: number;
}

export interface ChunkResult {
  formattedNotes: string;
  state: ChunkProcessingState;
}

/**
 * Splits OCR text into chunks based on content and token limits
 */
export const splitOCRIntoChunks = (ocrText: string, maxTokensPerChunk: number = 1000): string[] => {
  const chunks: string[] = [];
  const pages = ocrText.split(/Page \d+:/g).filter(page => page.trim().length > 0);
  
  let currentChunk = '';
  let currentTokenCount = 0;
  
  for (let i = 0; i < pages.length; i++) {
    const pageContent = pages[i].trim();
    const pageTokens = Math.ceil(pageContent.length / 4); // Rough token estimation
    
    // If adding this page would exceed limit and we have content, create new chunk
    if (currentTokenCount + pageTokens > maxTokensPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = `Page ${i + 1}:\n${pageContent}`;
      currentTokenCount = pageTokens;
    } else {
      // Add page to current chunk
      if (currentChunk.length > 0) {
        currentChunk += `\n\nPage ${i + 1}:\n${pageContent}`;
      } else {
        currentChunk = `Page ${i + 1}:\n${pageContent}`;
      }
      currentTokenCount += pageTokens;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  console.log(`Split OCR into ${chunks.length} chunks`);
  return chunks;
};

/**
 * Analyzes chunk to extract current formatting state
 */
export const analyzeChunkForState = (chunk: string): Partial<ChunkProcessingState> => {
  const state: Partial<ChunkProcessingState> = {};
  
  // Find main headings (look for patterns like "Chapter 1", "Unit 1", etc.)
  const mainHeadingMatch = chunk.match(/(?:Chapter|Unit|Section|Part)\s+(\d+)/i);
  if (mainHeadingMatch) {
    state.lastMainHeadingNumber = parseInt(mainHeadingMatch[1]);
  }
  
  // Find numbered headings (1., 2., 3., etc.)
  const headingMatches = chunk.match(/^\d+\./gm);
  if (headingMatches) {
    const numbers = headingMatches.map(match => parseInt(match.replace('.', '')));
    state.lastHeadingNumber = Math.max(...numbers);
  }
  
  // Find sub-headings (1.1, 1.2, etc.)
  const subHeadingMatches = chunk.match(/^\d+\.\d+/gm);
  if (subHeadingMatches) {
    const numbers = subHeadingMatches.map(match => {
      const parts = match.split('.');
      return parseInt(parts[1]);
    });
    state.lastSubHeadingNumber = Math.max(...numbers);
  }
  
  return state;
};

/**
 * Creates context prompt for continuing formatting from previous chunks
 */
export const createContinuationPrompt = (state: ChunkProcessingState): string => {
  let context = "";
  
  if (state.processedChunks > 0) {
    context += `CONTINUATION CONTEXT - This is chunk ${state.processedChunks + 1} of ${state.totalChunks}.\n\n`;
    context += `PREVIOUS FORMATTING STATE:\n`;
    
    if (state.currentMainHeading) {
      context += `- Current main heading: ${state.currentMainHeading}\n`;
    }
    if (state.currentHeading) {
      context += `- Current heading: ${state.currentHeading}\n`;
    }
    if (state.currentSubHeading) {
      context += `- Current sub-heading: ${state.currentSubHeading}\n`;
    }
    
    context += `- Last main heading number: ${state.lastMainHeadingNumber}\n`;
    context += `- Last heading number: ${state.lastHeadingNumber}\n`;
    context += `- Last sub-heading number: ${state.lastSubHeadingNumber}\n\n`;
    
    context += `FORMATTING INSTRUCTIONS:\n`;
    context += `- Continue numbering from where previous chunk left off\n`;
    context += `- Maintain the same heading hierarchy and style\n`;
    context += `- If this chunk starts mid-section, continue within that section\n`;
    context += `- If this chunk starts a new major section, increment main heading appropriately\n`;
    context += `- Keep the exact same HTML formatting style as established\n\n`;
  }
  
  return context;
};

/**
 * Updates formatting state after processing a chunk
 */
export const updateStateAfterChunk = (
  previousState: ChunkProcessingState, 
  processedNotes: string, 
  chunkIndex: number
): ChunkProcessingState => {
  const newState = { ...previousState };
  
  // Extract headings from the processed notes
  const mainHeadingMatches = processedNotes.match(/<h1[^>]*>.*?<\/h1>/g);
  const headingMatches = processedNotes.match(/<h2[^>]*>.*?<\/h2>/g);
  const subHeadingMatches = processedNotes.match(/<h3[^>]*>.*?<\/h3>/g);
  
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
  
  // Extract numbers from headings to maintain continuity
  const extractedState = analyzeChunkForState(processedNotes);
  if (extractedState.lastMainHeadingNumber !== undefined) {
    newState.lastMainHeadingNumber = extractedState.lastMainHeadingNumber;
  }
  if (extractedState.lastHeadingNumber !== undefined) {
    newState.lastHeadingNumber = extractedState.lastHeadingNumber;
  }
  if (extractedState.lastSubHeadingNumber !== undefined) {
    newState.lastSubHeadingNumber = extractedState.lastSubHeadingNumber;
  }
  
  newState.processedChunks = chunkIndex + 1;
  
  return newState;
};

/**
 * Merges all processed chunk results into final notes
 */
export const mergeChunkResults = (chunkResults: string[]): string => {
  if (chunkResults.length === 0) return '';
  if (chunkResults.length === 1) return chunkResults[0];
  
  let mergedNotes = '';
  
  for (let i = 0; i < chunkResults.length; i++) {
    const chunk = chunkResults[i];
    
    if (i === 0) {
      // First chunk - include everything
      mergedNotes = chunk;
    } else {
      // Subsequent chunks - remove duplicate main title if present
      let chunkContent = chunk;
      
      // Remove duplicate main title (h1 tags)
      const h1Match = chunkContent.match(/<h1[^>]*>.*?<\/h1>/);
      if (h1Match && mergedNotes.includes(h1Match[0])) {
        chunkContent = chunkContent.replace(h1Match[0], '');
      }
      
      // Clean up extra whitespace and add to merged notes
      chunkContent = chunkContent.trim();
      if (chunkContent) {
        mergedNotes += '\n\n' + chunkContent;
      }
    }
  }
  
  // Clean up the final result
  mergedNotes = mergedNotes
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(<\/h[1-6]>)\s*(<h[1-6])/g, '$1\n\n$2')
    .replace(/(<\/p>)\s*(<[hp])/g, '$1\n\n$2')
    .trim();
  
  return mergedNotes;
};

/**
 * Processes OCR text in chunks with state preservation
 */
export const processOCRInChunks = async (
  ocrText: string,
  onProgress?: (current: number, total: number, status: string) => void
): Promise<string> => {
  try {
    // Split OCR into manageable chunks
    const chunks = splitOCRIntoChunks(ocrText, 1000);
    
    if (chunks.length === 1) {
      // Single chunk - use regular processing
      onProgress?.(1, 1, "Processing single chunk...");
      return await processSingleChunk(chunks[0], {
        lastMainHeadingNumber: 0,
        lastHeadingNumber: 0,
        lastSubHeadingNumber: 0,
        lastBulletLevel: 0,
        lastNumberLevel: 0,
        currentMainHeading: '',
        currentHeading: '',
        currentSubHeading: '',
        processedChunks: 0,
        totalChunks: 1
      });
    }
    
    // Multi-chunk processing
    const chunkResults: string[] = [];
    let state: ChunkProcessingState = {
      lastMainHeadingNumber: 0,
      lastHeadingNumber: 0,
      lastSubHeadingNumber: 0,
      lastBulletLevel: 0,
      lastNumberLevel: 0,
      currentMainHeading: '',
      currentHeading: '',
      currentSubHeading: '',
      processedChunks: 0,
      totalChunks: chunks.length
    };
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      onProgress?.(i + 1, chunks.length, `Processing chunk ${i + 1} of ${chunks.length}...`);
      
      // Process this chunk with continuation context
      const processedNotes = await processSingleChunk(chunk, state);
      chunkResults.push(processedNotes);
      
      // Update state for next chunk
      state = updateStateAfterChunk(state, processedNotes, i);
      
      // Small delay to prevent rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    onProgress?.(chunks.length, chunks.length, "Merging all chunks...");
    
    // Merge all results
    const finalNotes = mergeChunkResults(chunkResults);
    
    console.log(`Successfully processed ${chunks.length} chunks into final notes`);
    return finalNotes;
    
  } catch (error) {
    console.error("Error in chunk processing:", error);
    throw error;
  }
};

/**
 * Processes a single chunk with Groq API
 */
const processSingleChunk = async (chunk: string, state: ChunkProcessingState): Promise<string> => {
  const GROQ_API_KEY = "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";
  const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
  
  const continuationPrompt = createContinuationPrompt(state);
  
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
          content: `You are an expert note creator. Create detailed and complete HTML-formatted notes from PDF text in simple language, as if explaining to a 7th-grade student.

${continuationPrompt}

RULES:
1. Use ONLY HTML formatting (no Markdown)
2. Include ALL information from the PDF chunk and dont omitt anything
3. Use simple language (7th grade level)
4. Break down complex concepts into easy-to-understand points
5. Wrap key terms and main concepts in <strong> tags
6. Use proper HTML structure with three-level lists
7. If continuing from previous chunks, maintain exact same formatting style and numbering

FORMATTING:
- Main headings: <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Title</span></span></h1>
- Section headings: <h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">Section</span></span></h2>
- Sub-headings: <h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">Sub-section</span></span></h3>
- Paragraphs: <p>Content with <strong>key terms</strong></p>

THREE-LEVEL BULLET LISTS:
- Level 1: <ul><li>Main point with <strong>key terms</strong></li></ul>
- Level 2: <ul><li>Main point<ul><li>Sub-point with details</li></ul></li></ul>
- Level 3: <ul><li>Main point<ul><li>Sub-point<ul><li>Detailed sub-point</li></ul></li></ul></li></ul>

THREE-LEVEL NUMBERED LISTS:
- Level 1: <ol><li>First main item with <strong>key terms</strong></li></ol>
- Level 2: <ol><li>Main item<ol><li>Sub-item with details</li></ol></li></ol>
- Level 3: <ol><li>Main item<ol><li>Sub-item<ol><li>Detailed sub-item</li></ol></li></ol></li></ol>

Add proper spacing between sections and ensure all content is preserved.`
        },
        {
          role: "user",
          content: `Create detailed and complete HTML-formatted notes from this PDF chunk in simple language: ${chunk}`
        }
      ],
      temperature: 0.3,
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
