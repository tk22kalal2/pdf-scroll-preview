
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
  const { chunks, documentStructure } = chunkingResult;
  const processedChunks: ProcessedChunk[] = [];
  
  // Phase 1: Process each chunk
  onProgress?.({
    currentChunk: 0,
    totalChunks: chunks.length,
    phase: 'processing',
    message: 'Starting hierarchical processing...'
  });
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    onProgress?.({
      currentChunk: i + 1,
      totalChunks: chunks.length,
      phase: 'processing',
      message: `Processing chunk ${i + 1} of ${chunks.length}...`
    });
    
    try {
      const processedContent = await processSingleChunk(chunk, documentStructure);
      processedChunks.push({
        id: chunk.id,
        processedContent,
        originalChunk: chunk,
        success: true
      });
    } catch (error) {
      console.error(`Error processing chunk ${chunk.id}:`, error);
      processedChunks.push({
        id: chunk.id,
        processedContent: `<p><strong>Error processing this section:</strong> ${chunk.content}</p>`,
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
    message: 'Merging processed chunks...'
  });
  
  const mergedContent = await mergeStructuredNotes(processedChunks, documentStructure);
  
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
async function processSingleChunk(chunk: ContentChunk, documentStructure: any): Promise<string> {
  const GROQ_API_KEY = "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";
  const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
  
  // Create context-aware prompt
  const contextInfo = chunk.headingContext.length > 0 
    ? `This content belongs under the following heading structure:\n${chunk.headingContext.map((h, i) => '  '.repeat(i) + `${h.level}. ${h.text}`).join('\n')}\n\n`
    : '';
  
  const systemPrompt = `You are an expert note creator. Create detailed and complete HTML-formatted notes from PDF text in simple language, as if explaining to a 7th-grade student.

${contextInfo}IMPORTANT CONTEXT: This is part ${chunk.id} of a larger document. Format this section to fit seamlessly with the overall document structure.

RULES:
1. Use ONLY HTML formatting (no Markdown)
2. Include ALL information from this text section
3. Use simple language (7th grade level)
4. Break down complex concepts into easy-to-understand points
5. Wrap key terms and main concepts in <strong> tags
6. Use proper HTML structure with three-level lists
7. DO NOT create duplicate main headings - focus on the content within the section

FORMATTING:
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

Format this section maintaining consistency with the overall document structure.`;

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
          content: `Format this section: ${chunk.content}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Merges processed chunks back into a cohesive document
 */
async function mergeStructuredNotes(processedChunks: ProcessedChunk[], documentStructure: any): Promise<string> {
  let mergedContent = `<h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Complete PDF Notes</span></span></h1>\n\n`;
  
  // Sort chunks by their original order in the document
  const sortedChunks = processedChunks.sort((a, b) => {
    const aOrder = parseInt(a.id.split('-')[1]) || 0;
    const bOrder = parseInt(b.id.split('-')[1]) || 0;
    return aOrder - bOrder;
  });
  
  // Merge content while removing duplicate headings
  let previousMainHeading = '';
  
  sortedChunks.forEach((processedChunk, index) => {
    let content = processedChunk.processedContent;
    
    // Remove duplicate main document heading if present
    content = content.replace(/<h1[^>]*>.*?<\/h1>/gi, '').trim();
    
    // Track main headings to avoid duplication
    const mainHeadingMatch = content.match(/<h2[^>]*>(.*?)<\/h2>/i);
    if (mainHeadingMatch) {
      const currentMainHeading = mainHeadingMatch[1];
      if (currentMainHeading === previousMainHeading) {
        // Remove duplicate main heading
        content = content.replace(/<h2[^>]*>.*?<\/h2>/i, '').trim();
      } else {
        previousMainHeading = currentMainHeading;
      }
    }
    
    if (content.trim()) {
      mergedContent += content + '\n\n';
    }
  });
  
  return mergedContent.trim();
}
