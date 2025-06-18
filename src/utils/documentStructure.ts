
export interface DocumentHeading {
  level: number; // 1=main, 2=section, 3=sub-section
  text: string;
  startIndex: number;
  endIndex: number;
  parentHeading?: DocumentHeading;
  children: DocumentHeading[];
}

export interface DocumentStructure {
  headings: DocumentHeading[];
  sections: DocumentSection[];
  totalLength: number;
}

export interface DocumentSection {
  heading: DocumentHeading;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Analyzes the document structure to identify headings and sections
 */
export function analyzeDocumentStructure(ocrText: string): DocumentStructure {
  const lines = ocrText.split('\n');
  const headings: DocumentHeading[] = [];
  let currentIndex = 0;
  
  // Patterns to identify different heading levels
  const mainHeadingPatterns = [
    /^[A-Z][A-Z\s]{10,}$/,  // ALL CAPS long headings
    /^CHAPTER\s+\d+/i,      // Chapter headings
    /^SECTION\s+[A-Z0-9]/i, // Section headings
    /^PART\s+[A-Z0-9]/i,    // Part headings
    /^[IVX]+\.\s+[A-Z]/,    // Roman numeral headings
    /^\d+\.\s+[A-Z][^.]{15,}$/  // Numbered long headings
  ];
  
  const sectionHeadingPatterns = [
    /^[A-Z][a-z\s]{8,}$/,   // Title case medium headings
    /^\d+\.\d+\s+[A-Z]/,   // Numbered sub-headings (1.1, 1.2)
    /^[A-Z]\.\s+[A-Z]/,    // Letter headings (A. Something)
    /^[a-z]\)\s+[A-Z]/     // Lettered items (a) Something)
  ];
  
  const subHeadingPatterns = [
    /^[A-Z][a-z\s]{5,15}$/,  // Short title case
    /^\d+\.\d+\.\d+\s+/,     // Triple numbered (1.1.1)
    /^[ivx]+\)\s+[A-Z]/,     // Roman lowercase
    /^\([a-z]\)\s+[A-Z]/     // Parenthetical letters
  ];
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) return;
    
    let level = 0;
    let isHeading = false;
    
    // Check for main headings (level 1)
    if (mainHeadingPatterns.some(pattern => pattern.test(trimmed))) {
      level = 1;
      isHeading = true;
    }
    // Check for section headings (level 2)
    else if (sectionHeadingPatterns.some(pattern => pattern.test(trimmed))) {
      level = 2;
      isHeading = true;
    }
    // Check for sub-headings (level 3)
    else if (subHeadingPatterns.some(pattern => pattern.test(trimmed))) {
      level = 3;
      isHeading = true;
    }
    // Additional heuristic: short lines without periods might be headings
    else if (trimmed.length < 60 && !trimmed.endsWith('.') && 
             !trimmed.endsWith(',') && !trimmed.endsWith(';') &&
             /^[A-Z]/.test(trimmed) && trimmed.split(' ').length > 1) {
      level = 3;
      isHeading = true;
    }
    
    if (isHeading) {
      const heading: DocumentHeading = {
        level,
        text: trimmed,
        startIndex: currentIndex,
        endIndex: currentIndex + line.length,
        children: []
      };
      
      // Find parent heading
      for (let i = headings.length - 1; i >= 0; i--) {
        if (headings[i].level < level) {
          heading.parentHeading = headings[i];
          headings[i].children.push(heading);
          break;
        }
      }
      
      headings.push(heading);
    }
    
    currentIndex += line.length + 1; // +1 for newline
  });
  
  // Create sections based on headings
  const sections = createSections(ocrText, headings);
  
  return {
    headings,
    sections,
    totalLength: ocrText.length
  };
}

/**
 * Creates document sections based on identified headings
 */
function createSections(ocrText: string, headings: DocumentHeading[]): DocumentSection[] {
  const sections: DocumentSection[] = [];
  
  headings.forEach((heading, index) => {
    const nextHeading = headings[index + 1];
    const sectionEndIndex = nextHeading ? nextHeading.startIndex : ocrText.length;
    
    const content = ocrText.substring(heading.startIndex, sectionEndIndex).trim();
    
    sections.push({
      heading,
      content,
      startIndex: heading.startIndex,
      endIndex: sectionEndIndex
    });
  });
  
  return sections;
}
