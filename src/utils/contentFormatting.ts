
import { isBulletList, isNumberedList, isPotentialHeading, highlightKeyTerms } from './textFormatting';

/**
 * Creates enhanced fallback notes with improved formatting
 * Ensures ALL original content is preserved while adding better structure
 */
export function createEnhancedFallbackNotes(text: string): string {
  // Start with a header explaining this is fallback formatting
  let formattedHtml = `
    <h1><span style="text-decoration: underline;"><span style="color: rgb(71, 0, 0); text-decoration: underline;">Complete PDF Content (Enhanced Formatting)</span></span></h1>
    <p>Below is the <strong>complete text</strong> extracted from your PDF with improved formatting for better readability.</p>
    <p>The notes below preserve <strong>100% of the original content</strong> from your PDF.</p>
  `;
  
  // Extract pages and preserve ALL content
  const pages = text.split(/Page \d+:/g).filter(page => page.trim().length > 0);
  const pageHeaders = text.match(/Page \d+:/g) || [];
  
  // If no pages were found or just one page, format the entire text
  if (pages.length <= 1) {
    const processedText = text.replace(/Page \d+:/g, '');
    formattedHtml += formatPageContent(processedText);
    return formattedHtml;
  }
  
  // Process each page to preserve ALL content with better formatting
  pages.forEach((page, index) => {
    const pageTitle = pageHeaders[index] || `Page ${index + 1}:`;
    
    // Add page title as h2
    formattedHtml += `
      <h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">${pageTitle}</span></span></h2>
    `;
    
    // Add the formatted page content
    formattedHtml += formatPageContent(page);
    
    // Add separator between pages
    if (index < pages.length - 1) {
      formattedHtml += `<hr style="margin: 20px 0; border-top: 1px dashed #ccc;" />`;
    }
  });
  
  return formattedHtml;
}

/**
 * Formats a page of content with enhanced readability
 * with special handling for lists and structured content
 */
export function formatPageContent(content: string): string {
  let formattedContent = '';
  
  // Split content into sections based on potential headers or clear paragraph breaks
  const sections = content.split(/\n\s*\n|\r\n\s*\r\n/).filter(s => s.trim().length > 0);
  
  if (sections.length === 0) {
    // If no sections detected, preserve raw content to ensure nothing is lost
    return `<p>${content.trim()}</p>`;
  }
  
  // Process each section, looking for special structures like lists
  sections.forEach(section => {
    section = section.trim();
    
    // Skip empty sections
    if (section.length === 0) return;
    
    // 1. Check if section looks like a bullet list
    if (isBulletList(section)) {
      formattedContent += formatAsBulletList(section);
      return;
    }
    
    // 2. Check if section looks like a numbered list
    if (isNumberedList(section)) {
      formattedContent += formatAsNumberedList(section);
      return;
    }
    
    // 3. Check if section might be a heading
    if (isPotentialHeading(section)) {
      formattedContent += formatAsHeading(section);
      return;
    }
    
    // 4. Handle standard paragraphs with enhanced formatting
    formattedContent += formatAsParagraph(section);
  });
  
  return formattedContent;
}

/**
 * Format text as a bullet list
 */
export function formatAsBulletList(text: string): string {
  // Split by common bullet point indicators
  const lines = text.split("\n");
  let inList = false;
  let html = '';
  let currentListItems = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line is a bullet point
    if (/^\s*[•\*\-]\s+/.test(line)) {
      // Extract the content after the bullet
      const content = line.replace(/^\s*[•\*\-]\s+/, '').trim();
      
      if (!inList) {
        // Start a new list
        currentListItems = `<li>${highlightKeyTerms(content)}</li>`;
        inList = true;
      } else {
        // Add to existing list
        currentListItems += `<li>${highlightKeyTerms(content)}</li>`;
      }
    } else if (inList) {
      // End current list and add non-list content
      html += `<ul style="margin-left: 20px; margin-bottom: 15px;">${currentListItems}</ul>`;
      inList = false;
      currentListItems = '';
      
      // Add the non-bullet line as paragraph
      if (line.length > 0) {
        html += `<p style="margin-bottom: 15px; line-height: 1.5;">${highlightKeyTerms(line)}</p>`;
      }
    } else if (line.length > 0) {
      // Regular paragraph
      html += `<p style="margin-bottom: 15px; line-height: 1.5;">${highlightKeyTerms(line)}</p>`;
    }
  }
  
  // Close any open list
  if (inList) {
    html += `<ul style="margin-left: 20px; margin-bottom: 15px;">${currentListItems}</ul>`;
  }
  
  return html;
}

/**
 * Format text as a numbered list
 */
export function formatAsNumberedList(text: string): string {
  // Similar to bullet list but for numbered items
  const lines = text.split("\n");
  let inList = false;
  let html = '';
  let currentListItems = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line is a numbered item
    if (/^\s*\d+[\.\)]\s+/.test(line)) {
      // Extract the content after the number
      const content = line.replace(/^\s*\d+[\.\)]\s+/, '').trim();
      
      if (!inList) {
        // Start a new list
        currentListItems = `<li>${highlightKeyTerms(content)}</li>`;
        inList = true;
      } else {
        // Add to existing list
        currentListItems += `<li>${highlightKeyTerms(content)}</li>`;
      }
    } else if (inList) {
      // End current list and add non-list content
      html += `<ol style="margin-left: 20px; margin-bottom: 15px;">${currentListItems}</ol>`;
      inList = false;
      currentListItems = '';
      
      // Add the non-numbered line as paragraph
      if (line.length > 0) {
        html += `<p style="margin-bottom: 15px; line-height: 1.5;">${highlightKeyTerms(line)}</p>`;
      }
    } else if (line.length > 0) {
      // Regular paragraph
      html += `<p style="margin-bottom: 15px; line-height: 1.5;">${highlightKeyTerms(line)}</p>`;
    }
  }
  
  // Close any open list
  if (inList) {
    html += `<ol style="margin-left: 20px; margin-bottom: 15px;">${currentListItems}</ol>`;
  }
  
  return html;
}

/**
 * Format text as a heading
 */
export function formatAsHeading(text: string): string {
  // Determine heading level based on characteristics
  let level = 3; // Default to h3
  
  if (text.length < 40 && text === text.toUpperCase()) {
    level = 2; // Shorter, all caps gets h2
  }
  
  if (text.length < 20) {
    level = 2; // Very short gets h2
  }
  
  // Format as appropriate heading level
  if (level === 2) {
    return `<h2><span style="text-decoration: underline;"><span style="color: rgb(26, 1, 157); text-decoration: underline;">${text}</span></span></h2>`;
  } else {
    return `<h3><span style="text-decoration: underline;"><span style="color: rgb(52, 73, 94); text-decoration: underline;">${text}</span></span></h3>`;
  }
}

/**
 * Format text as a regular paragraph with enhanced readability
 */
export function formatAsParagraph(text: string): string {
  // Check for special patterns within the paragraph that might indicate lists
  if (text.includes("* ") && text.split("* ").length > 2) {
    // This paragraph contains bullet-like items
    const parts = text.split("* ");
    let html = '';
    
    // First part might be an introduction
    if (parts[0].trim().length > 0) {
      html += `<p style="margin-bottom: 15px; line-height: 1.5;">${highlightKeyTerms(parts[0].trim())}</p>`;
    }
    
    // Format remaining parts as a list
    html += '<ul style="margin-left: 20px; margin-bottom: 15px;">';
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].trim().length > 0) {
        html += `<li>${highlightKeyTerms(parts[i].trim())}</li>`;
      }
    }
    html += '</ul>';
    
    return html;
  }
  
  // Regular paragraph processing
  // Break into sentences for better readability while preserving ALL content
  const sentences = text.split(/(?<=\.|\?|\!)\s+/);
  let enhancedParagraph = '';
  
  sentences.forEach(sentence => {
    if (sentence.trim().length === 0) return;
    
    // Highlight potential key terms in each sentence
    enhancedParagraph += highlightKeyTerms(sentence.trim()) + ' ';
  });
  
  // Add the formatted paragraph
  return `<p style="margin-bottom: 15px; line-height: 1.5;">${enhancedParagraph}</p>`;
}
