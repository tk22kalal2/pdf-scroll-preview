
import { ContentChunk, ChunkingResult } from './contentChunking';
import { toast } from 'sonner';

export interface ProcessingProgress {
  currentChunk: number;
  totalChunks: number;
  phase: 'analyzing' | 'chunking' | 'processing' | 'merging' | 'complete';
  message: string;
}

export interface ProcessedChunk {
  id: string;
  processedContent: string;
  originalChunk: ContentChunk;
  success: boolean;
  error?: string;
}

/**
 * Processes chunks hierarchically while maintaining document structure
 */
export async function processChunksHierarchically(
  chunkingResult: ChunkingResult,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<string> {
  const { chunks, documentStructure, totalContentLength } = chunkingResult;
  const processedChunks: ProcessedChunk[] = [];
  
  console.log(`Starting hierarchical processing of ${chunks.length} chunks (${totalContentLength} total chars)`);
  
  // Phase 1: Process each chunk
  onProgress?.({
    currentChunk: 0,
    totalChunks: chunks.length,
    phase: 'processing',
    message: 'Starting hierarchical processing...'
  });
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.id} (${chunk.content.length} chars, pages ${chunk.pageNumbers.join(',')})`);
    
    onProgress?.({
      currentChunk: i + 1,
      totalChunks: chunks.length,
      phase: 'processing',
      message: `Processing ${chunk.pageNumbers.length > 0 ? `pages ${chunk.pageNumbers.join(', ')}` : `section ${i + 1}`} of ${chunks.length}...`
    });
    
    try {
      const processedContent = await processSingleChunk(chunk, documentStructure, i + 1, chunks.length);
      processedChunks.push({
        id: chunk.id,
        processedContent,
        originalChunk: chunk,
        success: true
      });
      
      console.log(`Successfully processed chunk ${chunk.id}: ${processedContent.length} chars output`);
    } catch (error) {
      console.error(`Error processing chunk ${chunk.id}:`, error);
      
      // Create fallback content to ensure nothing is lost
      const fallbackContent = createFallbackContent(chunk);
      processedChunks.push({
        id: chunk.id,
        processedContent: fallbackContent,
        originalChunk: chunk,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Phase 2: Merge processed chunks
  onProgress?.({
    currentChunk: chunks.length,
    totalChunks: chunks.length,
    phase: 'merging',
    message: 'Merging processed chunks into complete document...'
  });
  
  const mergedContent = await mergeStructuredNotes(processedChunks, documentStructure);
  
  console.log(`Final merged content: ${mergedContent.length} characters`);
  
  onProgress?.({
    currentChunk: chunks.length,
    totalChunks: chunks.length,
    phase: 'complete',
    message: 'Processing complete!'
  });
  
  return mergedContent;
}

/**
 * Processes a single chunk with appropriate context
 */
async function processSingleChunk(
  chunk: ContentChunk, 
  documentStructure: any, 
  chunkIndex: number, 
  totalChunks: number
): Promise<string> {
  const GROQ_API_KEY = "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";
  const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
  
  // Create comprehensive context information
  const contextInfo = buildContextInfo(chunk, chunkIndex, totalChunks);
  
  const systemPrompt = `You are an expert note creator. Create detailed and complete HTML-formatted notes from PDF text in simple language, as if explaining to a 7th-grade student.

${contextInfo}

CRITICAL REQUIREMENTS:
1. Process ALL content provided - do not skip any text
2. Use ONLY HTML formatting (no Markdown)
3. Include EVERY piece of information from the input text
4. Use simple language (7th grade level)
5. Break down complex concepts into easy-to-understand points
6. Wrap key terms and main concepts in <strong> tags
7. Create proper heading hierarchy based on the content structure

FORMATTING RULES:
- Main section headings: <h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">Section Title</span></span></h2>
- Sub-headings: <h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">Sub-section Title</span></span></h3>
- Sub-sub-headings: <h4><span style="text-decoration: underline;"><span style="color: rgb(120, 120, 120); text-decoration: underline;">Detail Title</span></span></h4>
- Paragraphs: <p>Content with <strong>key terms</strong></p>

THREE-LEVEL BULLET LISTS:
- Level 1: <ul><li>Main point with <strong>key terms</strong></li></ul>
- Level 2: <ul><li>Main point<ul><li>Sub-point with details</li></ul></li></ul>
- Level 3: <ul><li>Main point<ul><li>Sub-point<ul><li>Detailed explanation</li></ul></li></ul></li></ul>

THREE-LEVEL NUMBERED LISTS:
- Level 1: <ol><li>First main item with <strong>key terms</strong></li></ol>
- Level 2: <ol><li>Main item<ol><li>Sub-item with details</li></ol></li></ol>
- Level 3: <ol><li>Main item<ol><li>Sub-item<ol><li>Detailed sub-item</li></ol></li></ol></li></ol>

IMPORTANT: Every sentence, every concept, every detail from the input must be included in your output. Do not summarize or skip content.`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Process this content completely - include every detail:\n\n${chunk.content}`
        }
      ],
      temperature: 0.2, // Lower temperature for more consistent output
      max_tokens: 4000,  // Increased token limit
    })
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} - ${response.statusText}`);
  }
  
  const data = await response.json();
  const processedContent = data.choices[0].message.content;
  
  if (!processedContent || processedContent.trim().length === 0) {
    throw new Error("Empty response from API");
  }
  
  return processedContent;
}

/**
 * Build comprehensive context information for each chunk
 */
function buildContextInfo(chunk: ContentChunk, chunkIndex: number, totalChunks: number): string {
  let contextInfo = `DOCUMENT CONTEXT: This is section ${chunkIndex} of ${totalChunks} from a larger document.\n`;
  
  if (chunk.pageNumbers.length > 0) {
    contextInfo += `SOURCE PAGES: ${chunk.pageNumbers.join(', ')}\n`;
  }
  
  if (chunk.headingContext.length > 0) {
    contextInfo += `\nHEADING HIERARCHY:\n`;
    chunk.headingContext.forEach((heading, i) => {
      contextInfo += `${'  '.repeat(i)}${heading.level}. ${heading.text}\n`;
    });
  }
  
  if (chunk.sections.length > 0) {
    contextInfo += `\nSECTIONS IN THIS CHUNK:\n`;
    chunk.sections.forEach(section => {
      contextInfo += `- ${section.heading.text} (Level ${section.heading.level})\n`;
    });
  }
  
  contextInfo += `\nCONTENT LENGTH: ${chunk.content.length} characters\n`;
  contextInfo += `TOKEN COUNT: ${chunk.tokenCount}\n\n`;
  
  return contextInfo;
}

/**
 * Creates fallback content when API processing fails
 */
function createFallbackContent(chunk: ContentChunk): string {
  console.log(`Creating fallback content for chunk ${chunk.id}`);
  
  let html = '';
  
  if (chunk.pageNumbers.length > 0) {
    html += `<h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">Pages ${chunk.pageNumbers.join(', ')}</span></span></h2>\n`;
  }
  
  // Format the content as basic HTML
  const paragraphs = chunk.content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  paragraphs.forEach(paragraph => {
    const trimmed = paragraph.trim();
    if (!trimmed) return;
    
    // Check if it looks like a heading
    if (trimmed.length < 80 && !trimmed.endsWith('.') && !trimmed.endsWith(',') && 
        /^[A-Z]/.test(trimmed) && trimmed.split(' ').length <= 10) {
      html += `<h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">${trimmed}</span></span></h3>\n`;
    } else {
      // Highlight potential key terms
      const highlighted = trimmed.replace(/\b([A-Z][a-z]{3,}|[A-Z]{2,})\b/g, '<strong>$1</strong>');
      html += `<p>${highlighted}</p>\n`;
    }
  });
  
  return html;
}

/**
 * Merges processed chunks back into a cohesive document
 */
async function mergeStructuredNotes(processedChunks: ProcessedChunk[], documentStructure: any): Promise<string> {
  console.log(`Merging ${processedChunks.length} processed chunks`);
  
  let mergedContent = `<h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Complete PDF Notes</span></span></h1>\n\n`;
  
  // Sort chunks by their original order
  const sortedChunks = processedChunks.sort((a, b) => {
    const aOrder = parseInt(a.id.split('-')[1]) || 0;
    const bOrder = parseInt(b.id.split('-')[1]) || 0;
    return aOrder - bOrder;
  });
  
  // Track processed content length
  let totalProcessedLength = 0;
  let successfulChunks = 0;
  
  // Merge content while maintaining structure
  sortedChunks.forEach((processedChunk, index) => {
    let content = processedChunk.processedContent;
    
    if (processedChunk.success) {
      successfulChunks++;
    }
    
    // Remove duplicate main document heading if present
    content = content.replace(/<h1[^>]*>.*?<\/h1>/gi, '').trim();
    
    // Add section separator for multiple chunks
    if (index > 0 && sortedChunks.length > 1) {
      mergedContent += '\n\n';
    }
    
    if (content.trim()) {
      mergedContent += content + '\n\n';
      totalProcessedLength += content.length;
    }
    
    console.log(`Merged chunk ${processedChunk.id}: ${content.length} chars (success: ${processedChunk.success})`);
  });
  
  console.log(`Merge complete: ${totalProcessedLength} chars total, ${successfulChunks}/${processedChunks.length} chunks successful`);
  
  // Ensure we have substantial content
  if (mergedContent.trim().length < 1000) {
    console.warn("Merged content seems too short, adding debug info");
    mergedContent += `\n\n<p><em>Debug: Processed ${processedChunks.length} chunks, ${successfulChunks} successful</em></p>`;
  }
  
  return mergedContent.trim();
}
