
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
  pageBreaks: number[];
}

export interface DocumentSection {
  heading: DocumentHeading;
  content: string;
  startIndex: number;
  endIndex: number;
  pageNumber?: number;
}

/**
 * Analyzes the document structure to identify headings and sections
 */
export function analyzeDocumentStructure(ocrText: string): DocumentStructure {
  const lines = ocrText.split('\n');
  const headings: DocumentHeading[] = [];
  const pageBreaks: number[] = [];
  let currentIndex = 0;
  
  console.log(`Analyzing document with ${lines.length} lines, ${ocrText.length} characters`);
  
  // Find page breaks first
  lines.forEach((line, index) => {
    if (line.trim().match(/^Page \d+:/)) {
      pageBreaks.push(currentIndex);
    }
    currentIndex += line.length + 1;
  });
  
  console.log(`Found ${pageBreaks.length} page breaks`);
  
  // Reset current index for heading detection
  currentIndex = 0;
  
  // More comprehensive patterns to identify different heading levels
  const mainHeadingPatterns = [
    /^[A-Z][A-Z\s]{8,}$/,      // ALL CAPS headings (reduced min length)
    /^CHAPTER\s+\d+/i,         // Chapter headings
    /^SECTION\s+[A-Z0-9]/i,    // Section headings
    /^PART\s+[A-Z0-9]/i,       // Part headings
    /^[IVX]+\.\s+[A-Z]/,       // Roman numeral headings
    /^\d+\.\s+[A-Z][^.]{10,}$/, // Numbered long headings
    /^Unit\s+\d+/i,            // Unit headings
    /^Module\s+\d+/i,          // Module headings
    /^Lesson\s+\d+/i           // Lesson headings
  ];
  
  const sectionHeadingPatterns = [
    /^[A-Z][a-z\s]{6,}$/,      // Title case medium headings (reduced min)
    /^\d+\.\d+\s+[A-Z]/,       // Numbered sub-headings (1.1, 1.2)
    /^[A-Z]\.\s+[A-Z]/,        // Letter headings (A. Something)
    /^[a-z]\)\s+[A-Z]/,        // Lettered items (a) Something)
    /^[A-Z][a-z]+:\s*$/,       // Colon-ended headings
    /^\d+\.\s+[A-Z][a-z\s]{5,}$/, // Numbered headings
    /^Question\s+\d+/i,        // Question headings
    /^Exercise\s+\d+/i,        // Exercise headings
    /^Example\s+\d+/i          // Example headings
  ];
  
  const subHeadingPatterns = [
    /^[A-Z][a-z\s]{3,20}$/,    // Short title case (reduced range)
    /^\d+\.\d+\.\d+\s+/,       // Triple numbered (1.1.1)
    /^[ivx]+\)\s+[A-Z]/,       // Roman lowercase
    /^\([a-z]\)\s+[A-Z]/,      // Parenthetical letters
    /^\([0-9]+\)\s+[A-Z]/,     // Parenthetical numbers
    /^[a-z]\.\s+[A-Z]/,        // Lowercase letter headings
    /^\*\s+[A-Z]/,             // Bullet point headings
    /^-\s+[A-Z]/,              // Dash headings
    /^[A-Z][a-z]+\s+\d+/       // Word + number combinations
  ];
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2) {
      currentIndex += line.length + 1;
      return;
    }
    
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
    // Additional heuristic: short lines that look like headings
    else if (trimmed.length > 3 && trimmed.length < 80 && 
             !trimmed.endsWith('.') && !trimmed.endsWith(',') && 
             !trimmed.endsWith(';') && !trimmed.endsWith(':') &&
             /^[A-Z]/.test(trimmed) && 
             trimmed.split(' ').length <= 8 &&
             !trimmed.includes('  ')) { // Not too many spaces (likely not paragraph text)
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
      console.log(`Found level ${level} heading: "${trimmed}"`);
    }
    
    currentIndex += line.length + 1; // +1 for newline
  });
  
  console.log(`Total headings found: ${headings.length}`);
  
  // Create sections based on headings
  const sections = createSections(ocrText, headings, pageBreaks);
  
  return {
    headings,
    sections,
    totalLength: ocrText.length,
    pageBreaks
  };
}

/**
 * Creates document sections based on identified headings
 */
function createSections(ocrText: string, headings: DocumentHeading[], pageBreaks: number[]): DocumentSection[] {
  const sections: DocumentSection[] = [];
  
  // If no headings found, create sections based on pages
  if (headings.length === 0) {
    console.log("No headings found, creating sections by pages");
    const pages = ocrText.split(/Page \d+:/);
    pages.forEach((pageContent, index) => {
      if (pageContent.trim().length > 0) {
        const fakeHeading: DocumentHeading = {
          level: 1,
          text: `Page ${index + 1} Content`,
          startIndex: 0,
          endIndex: pageContent.length,
          children: []
        };
        
        sections.push({
          heading: fakeHeading,
          content: pageContent.trim(),
          startIndex: 0,
          endIndex: pageContent.length,
          pageNumber: index + 1
        });
      }
    });
    return sections;
  }
  
  headings.forEach((heading, index) => {
    const nextHeading = headings[index + 1];
    const sectionEndIndex = nextHeading ? nextHeading.startIndex : ocrText.length;
    
    const content = ocrText.substring(heading.startIndex, sectionEndIndex).trim();
    
    // Determine which page this section belongs to
    let pageNumber = 1;
    for (let i = 0; i < pageBreaks.length; i++) {
      if (heading.startIndex >= pageBreaks[i]) {
        pageNumber = i + 1;
      }
    }
    
    sections.push({
      heading,
      content,
      startIndex: heading.startIndex,
      endIndex: sectionEndIndex,
      pageNumber
    });
    
    console.log(`Section: "${heading.text}" (${content.length} chars, page ${pageNumber})`);
  });
  
  return sections;
}
