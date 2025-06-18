
import { DocumentStructure, DocumentSection, DocumentHeading } from './documentStructure';

export interface ContentChunk {
  id: string;
  content: string;
  headingContext: DocumentHeading[];
  sections: DocumentSection[];
  tokenCount: number;
  isComplete: boolean;
}

export interface ChunkingResult {
  chunks: ContentChunk[];
  totalChunks: number;
  documentStructure: DocumentStructure;
}

/**
 * Creates structured chunks that respect document hierarchy
 */
export function createStructuredChunks(
  ocrText: string, 
  documentStructure: DocumentStructure,
  maxTokens: number = 3500 // Leave buffer for system prompt
): ChunkingResult {
  const chunks: ContentChunk[] = [];
  let currentChunk: ContentChunk | null = null;
  
  // If document is small enough, return single chunk
  if (estimateTokens(ocrText) <= maxTokens) {
    return {
      chunks: [{
        id: 'single-chunk',
        content: ocrText,
        headingContext: documentStructure.headings.filter(h => h.level === 1),
        sections: documentStructure.sections,
        tokenCount: estimateTokens(ocrText),
        isComplete: true
      }],
      totalChunks: 1,
      documentStructure
    };
  }
  
  // Group sections by main headings for better chunking
  const sectionGroups = groupSectionsByMainHeading(documentStructure.sections);
  
  sectionGroups.forEach((sectionGroup, groupIndex) => {
    const groupContent = sectionGroup.sections.map(s => s.content).join('\n\n');
    const groupTokens = estimateTokens(groupContent);
    
    // If section group fits in one chunk
    if (groupTokens <= maxTokens) {
      chunks.push({
        id: `chunk-${groupIndex + 1}`,
        content: groupContent,
        headingContext: getHeadingContext(sectionGroup.mainHeading, documentStructure.headings),
        sections: sectionGroup.sections,
        tokenCount: groupTokens,
        isComplete: true
      });
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
          isComplete: subChunk.isComplete
        });
      });
    }
  });
  
  return {
    chunks,
    totalChunks: chunks.length,
    documentStructure
  };
}

interface SectionGroup {
  mainHeading: DocumentHeading;
  sections: DocumentSection[];
}

/**
 * Groups sections under their main headings
 */
function groupSectionsByMainHeading(sections: DocumentSection[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  let currentGroup: SectionGroup | null = null;
  
  sections.forEach(section => {
    if (section.heading.level === 1) {
      // Start new group
      currentGroup = {
        mainHeading: section.heading,
        sections: [section]
      };
      groups.push(currentGroup);
    } else if (currentGroup) {
      // Add to current group
      currentGroup.sections.push(section);
    } else {
      // No main heading found, create default group
      currentGroup = {
        mainHeading: {
          level: 1,
          text: 'Document Content',
          startIndex: 0,
          endIndex: 0,
          children: []
        },
        sections: [section]
      };
      groups.push(currentGroup);
    }
  });
  
  return groups;
}

/**
 * Splits a large section group into smaller chunks
 */
function splitSectionGroup(sectionGroup: SectionGroup, maxTokens: number): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let currentContent = '';
  let currentSections: DocumentSection[] = [];
  let chunkIndex = 0;
  
  sectionGroup.sections.forEach((section, index) => {
    const sectionContent = section.content;
    const sectionTokens = estimateTokens(sectionContent);
    const currentTokens = estimateTokens(currentContent);
    
    // If adding this section would exceed limit, save current chunk
    if (currentTokens + sectionTokens > maxTokens && currentContent.length > 0) {
      chunks.push({
        id: `section-chunk-${chunkIndex + 1}`,
        content: currentContent.trim(),
        headingContext: [sectionGroup.mainHeading],
        sections: currentSections,
        tokenCount: currentTokens,
        isComplete: true
      });
      
      currentContent = '';
      currentSections = [];
      chunkIndex++;
    }
    
    currentContent += (currentContent ? '\n\n' : '') + sectionContent;
    currentSections.push(section);
  });
  
  // Add remaining content as final chunk
  if (currentContent.trim().length > 0) {
    chunks.push({
      id: `section-chunk-${chunkIndex + 1}`,
      content: currentContent.trim(),
      headingContext: [sectionGroup.mainHeading],
      sections: currentSections,
      tokenCount: estimateTokens(currentContent),
      isComplete: true
    });
  }
  
  return chunks;
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
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}
