
import { DocumentStructure, DocumentSection, DocumentHeading } from './documentStructure';

export interface ContentChunk {
  id: string;
  content: string;
  headingContext: DocumentHeading[];
  sections: DocumentSection[];
  tokenCount: number;
  isComplete: boolean;
  pageNumbers: number[];
}

export interface ChunkingResult {
  chunks: ContentChunk[];
  totalChunks: number;
  documentStructure: DocumentStructure;
  totalContentLength: number;
}

/**
 * Creates structured chunks that respect document hierarchy and preserve ALL content
 */
export function createStructuredChunks(
  ocrText: string, 
  documentStructure: DocumentStructure,
  maxTokens: number = 3500
): ChunkingResult {
  console.log(`Starting chunking process for ${ocrText.length} characters`);
  
  const chunks: ContentChunk[] = [];
  
  // If document is small enough, return single chunk
  if (estimateTokens(ocrText) <= maxTokens) {
    console.log("Document fits in single chunk");
    return {
      chunks: [{
        id: 'single-chunk',
        content: ocrText,
        headingContext: documentStructure.headings.filter(h => h.level === 1),
        sections: documentStructure.sections,
        tokenCount: estimateTokens(ocrText),
        isComplete: true,
        pageNumbers: Array.from({length: documentStructure.pageBreaks.length || 1}, (_, i) => i + 1)
      }],
      totalChunks: 1,
      documentStructure,
      totalContentLength: ocrText.length
    };
  }
  
  // If no sections found, chunk by pages to ensure all content is included
  if (documentStructure.sections.length === 0) {
    console.log("No sections found, chunking by pages");
    return chunkByPages(ocrText, maxTokens);
  }
  
  // Group sections intelligently
  const sectionGroups = groupSectionsSmart(documentStructure.sections, maxTokens);
  console.log(`Created ${sectionGroups.length} section groups`);
  
  let totalProcessedLength = 0;
  
  sectionGroups.forEach((sectionGroup, groupIndex) => {
    const groupContent = sectionGroup.sections.map(s => s.content).join('\n\n');
    const groupTokens = estimateTokens(groupContent);
    const pageNumbers = [...new Set(sectionGroup.sections.map(s => s.pageNumber).filter(p => p))];
    
    totalProcessedLength += groupContent.length;
    
    // If section group fits in one chunk
    if (groupTokens <= maxTokens) {
      chunks.push({
        id: `chunk-${groupIndex + 1}`,
        content: groupContent,
        headingContext: getHeadingContext(sectionGroup.mainHeading, documentStructure.headings),
        sections: sectionGroup.sections,
        tokenCount: groupTokens,
        isComplete: true,
        pageNumbers: pageNumbers
      });
      
      console.log(`Created chunk ${groupIndex + 1}: ${groupContent.length} chars, pages ${pageNumbers.join(',')}`);
    } else {
      // Split large section group into smaller chunks
      const subChunks = splitSectionGroup(sectionGroup, maxTokens);
      subChunks.forEach((subChunk, subIndex) => {
        chunks.push({
          id: `chunk-${groupIndex + 1}-${subIndex + 1}`,
          content: subChunk.content,
          headingContext: getHeadingContext(sectionGroup.mainHeading, documentStructure.headings),
          sections: subChunk.sections,
          tokenCount: subChunk.tokenCount,
          isComplete: subChunk.isComplete,
          pageNumbers: subChunk.pageNumbers
        });
        
        console.log(`Created sub-chunk ${groupIndex + 1}-${subIndex + 1}: ${subChunk.content.length} chars`);
      });
    }
  });
  
  console.log(`Total content processed: ${totalProcessedLength}/${ocrText.length} characters`);
  
  // Verify no content was lost
  if (totalProcessedLength < ocrText.length * 0.95) {
    console.warn("Significant content may have been lost during chunking");
    // Add remaining content as final chunk
    const remainingContent = findMissingContent(ocrText, chunks);
    if (remainingContent.trim().length > 100) {
      chunks.push({
        id: `chunk-remaining`,
        content: remainingContent,
        headingContext: [],
        sections: [],
        tokenCount: estimateTokens(remainingContent),
        isComplete: true,
        pageNumbers: []
      });
      console.log(`Added remaining content chunk: ${remainingContent.length} chars`);
    }
  }
  
  return {
    chunks,
    totalChunks: chunks.length,
    documentStructure,
    totalContentLength: ocrText.length
  };
}

interface SectionGroup {
  mainHeading: DocumentHeading;
  sections: DocumentSection[];
}

/**
 * Groups sections more intelligently to preserve content
 */
function groupSectionsSmart(sections: DocumentSection[], maxTokens: number): SectionGroup[] {
  const groups: SectionGroup[] = [];
  let currentGroup: SectionGroup | null = null;
  let currentTokens = 0;
  
  sections.forEach(section => {
    const sectionTokens = estimateTokens(section.content);
    
    // If this is a main heading or we need to start a new group
    if (section.heading.level === 1 || !currentGroup || (currentTokens + sectionTokens > maxTokens && currentTokens > 0)) {
      // Save current group if exists
      if (currentGroup) {
        groups.push(currentGroup);
      }
      
      // Start new group
      currentGroup = {
        mainHeading: section.heading.level === 1 ? section.heading : {
          level: 1,
          text: `Section Group ${groups.length + 1}`,
          startIndex: section.startIndex,
          endIndex: section.endIndex,
          children: []
        },
        sections: [section]
      };
      currentTokens = sectionTokens;
    } else if (currentGroup) {
      // Add to current group
      currentGroup.sections.push(section);
      currentTokens += sectionTokens;
    }
  });
  
  // Add final group
  if (currentGroup) {
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Chunk by pages when no sections are found
 */
function chunkByPages(ocrText: string, maxTokens: number): ChunkingResult {
  const pages = ocrText.split(/Page \d+:/).filter(page => page.trim().length > 0);
  const chunks: ContentChunk[] = [];
  
  let currentChunk = '';
  let currentPageNumbers: number[] = [];
  let chunkIndex = 0;
  
  pages.forEach((pageContent, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const pageTokens = estimateTokens(pageContent);
    const currentTokens = estimateTokens(currentChunk);
    
    if (currentTokens + pageTokens > maxTokens && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        id: `page-chunk-${chunkIndex + 1}`,
        content: currentChunk.trim(),
        headingContext: [],
        sections: [],
        tokenCount: currentTokens,
        isComplete: true,
        pageNumbers: currentPageNumbers
      });
      
      currentChunk = '';
      currentPageNumbers = [];
      chunkIndex++;
    }
    
    currentChunk += (currentChunk ? '\n\n' : '') + `Page ${pageNumber}:\n${pageContent}`;
    currentPageNumbers.push(pageNumber);
  });
  
  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: `page-chunk-${chunkIndex + 1}`,
      content: currentChunk.trim(),
      headingContext: [],
      sections: [],
      tokenCount: estimateTokens(currentChunk),
      isComplete: true,
      pageNumbers: currentPageNumbers
    });
  }
  
  return {
    chunks,
    totalChunks: chunks.length,
    documentStructure: {
      headings: [],
      sections: [],
      totalLength: ocrText.length,
      pageBreaks: []
    },
    totalContentLength: ocrText.length
  };
}

/**
 * Splits a large section group into smaller chunks
 */
function splitSectionGroup(sectionGroup: SectionGroup, maxTokens: number): Array<{
  content: string;
  sections: DocumentSection[];
  tokenCount: number;
  isComplete: boolean;
  pageNumbers: number[];
}> {
  const chunks: Array<{
    content: string;
    sections: DocumentSection[];
    tokenCount: number;
    isComplete: boolean;
    pageNumbers: number[];
  }> = [];
  
  let currentContent = '';
  let currentSections: DocumentSection[] = [];
  let currentPageNumbers: number[] = [];
  
  sectionGroup.sections.forEach((section, index) => {
    const sectionContent = section.content;
    const sectionTokens = estimateTokens(sectionContent);
    const currentTokens = estimateTokens(currentContent);
    
    // If adding this section would exceed limit, save current chunk
    if (currentTokens + sectionTokens > maxTokens && currentContent.length > 0) {
      chunks.push({
        content: currentContent.trim(),
        sections: currentSections,
        tokenCount: currentTokens,
        isComplete: true,
        pageNumbers: [...new Set(currentPageNumbers)]
      });
      
      currentContent = '';
      currentSections = [];
      currentPageNumbers = [];
    }
    
    currentContent += (currentContent ? '\n\n' : '') + sectionContent;
    currentSections.push(section);
    if (section.pageNumber) {
      currentPageNumbers.push(section.pageNumber);
    }
  });
  
  // Add remaining content as final chunk
  if (currentContent.trim().length > 0) {
    chunks.push({
      content: currentContent.trim(),
      sections: currentSections,
      tokenCount: estimateTokens(currentContent),
      isComplete: true,
      pageNumbers: [...new Set(currentPageNumbers)]
    });
  }
  
  return chunks;
}

/**
 * Find content that might have been missed during chunking
 */
function findMissingContent(originalText: string, chunks: ContentChunk[]): string {
  const processedContent = chunks.map(chunk => chunk.content).join('\n\n');
  
  // Simple approach: if original is much larger, return the difference
  if (originalText.length > processedContent.length * 1.1) {
    // Extract content that might have been missed
    const originalLines = originalText.split('\n');
    const processedLines = processedContent.split('\n');
    
    const missingLines = originalLines.filter(line => 
      line.trim().length > 0 && !processedLines.includes(line)
    );
    
    return missingLines.join('\n');
  }
  
  return '';
}

/**
 * Gets the heading context for a section (parent headings)
 */
function getHeadingContext(heading: DocumentHeading, allHeadings: DocumentHeading[]): DocumentHeading[] {
  const context: DocumentHeading[] = [];
  let current: DocumentHeading | undefined = heading;
  
  while (current) {
    context.unshift(current);
    current = current.parentHeading;
  }
  
  return context;
}

/**
 * Estimates token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // More accurate estimation: ~3.5 characters per token for English text
  return Math.ceil(text.length / 3.5);
}
