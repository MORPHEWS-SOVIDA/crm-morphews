import React from 'react';

/**
 * Parses WhatsApp-style text formatting into React elements.
 * Supports: *bold*, _italic_, ~strikethrough~, ```monospace```
 */
export function formatWhatsAppText(text: string): React.ReactNode {
  if (!text) return null;

  // Split by double newlines first to create paragraph blocks with spacing
  const paragraphs = text.split(/\n{2,}/);
  
  const result: React.ReactNode[] = [];

  paragraphs.forEach((paragraph, paraIndex) => {
    if (paraIndex > 0) {
      // Add visual paragraph spacing (margin) for double+ newlines
      result.push(<div key={`para-spacer-${paraIndex}`} className="h-2" />);
    }

    // Within each paragraph, handle single newlines as <br>
    const lines = paragraph.split('\n');
    
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        result.push(<br key={`br-${paraIndex}-${lineIndex}`} />);
      }

      // Parse inline formatting for each line
      const formatted = parseInlineFormatting(line, `${paraIndex}-${lineIndex}`);
      result.push(...formatted);
    });
  });

  return <>{result}</>;
}

function parseInlineFormatting(text: string, lineKey: number | string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  
  // Combined regex for WhatsApp formatting patterns
  // Order matters: ```code``` first, then *bold*, _italic_, ~strikethrough~
  const formatRegex = /```([\s\S]*?)```|\*([^*\n]+?)\*|_([^_\n]+?)_|~([^~\n]+?)~/g;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = formatRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push(
        <React.Fragment key={`${lineKey}-t-${partIndex++}`}>
          {text.slice(lastIndex, match.index)}
        </React.Fragment>
      );
    }

    const key = `${lineKey}-f-${partIndex++}`;

    if (match[1] !== undefined) {
      // ```monospace```
      result.push(
        <code key={key} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
          {match[1]}
        </code>
      );
    } else if (match[2] !== undefined) {
      // *bold*
      result.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      // _italic_
      result.push(<em key={key}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      // ~strikethrough~
      result.push(<s key={key}>{match[4]}</s>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(
      <React.Fragment key={`${lineKey}-t-${partIndex++}`}>
        {text.slice(lastIndex)}
      </React.Fragment>
    );
  }

  // If nothing was parsed, return original text
  if (result.length === 0) {
    result.push(
      <React.Fragment key={`${lineKey}-t-0`}>{text}</React.Fragment>
    );
  }

  return result;
}
