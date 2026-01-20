import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName } = await req.json();

    if (!pdfBase64) {
      throw new Error('PDF base64 data is required');
    }

    console.log(`Processing PDF: ${fileName}`);

    // Decode base64 to binary
    const binaryString = atob(pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Use pdf-parse equivalent for Deno - extract text content
    // For now, we'll use a simple text extraction approach
    // Since we can't use pdf-parse directly in Deno, we'll parse the PDF structure manually
    
    const pdfContent = new TextDecoder('latin1').decode(bytes);
    
    // Extract text content from PDF streams
    const pages: string[] = [];
    
    // Find all stream objects and extract text
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    let match;
    let allText = '';
    
    while ((match = streamRegex.exec(pdfContent)) !== null) {
      const streamContent = match[1];
      // Try to decode deflate compressed streams or raw text
      try {
        // Extract text operators (Tj, TJ, etc.)
        const textMatches = streamContent.match(/\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g);
        if (textMatches) {
          for (const tm of textMatches) {
            const extracted = tm.replace(/\(|\)|Tj|TJ|\[|\]/g, ' ').trim();
            if (extracted) {
              allText += extracted + '\n';
            }
          }
        }
      } catch (e) {
        // Ignore decoding errors
      }
    }

    // If we couldn't extract text properly, return raw content split by page markers
    if (!allText.trim()) {
      // Look for page breaks in the PDF content
      const pageBreaks = pdfContent.split(/\/Type\s*\/Page[^s]/);
      
      // For each potential page, extract any readable text
      for (let i = 1; i < pageBreaks.length; i++) {
        const pageContent = pageBreaks[i];
        // Extract strings that look like text (between parentheses in PDF)
        const textStrings = pageContent.match(/\(([^)]{2,})\)/g);
        if (textStrings) {
          const pageText = textStrings
            .map(s => s.slice(1, -1)) // Remove parentheses
            .filter(s => s.length > 1 && !/^[\x00-\x1F]+$/.test(s)) // Filter control chars
            .join(' ');
          if (pageText.trim()) {
            pages.push(pageText);
          }
        }
      }
    } else {
      // Split by ROMANEIO markers
      const romaneioSections = allText.split(/(?=ROMANEIO:)/);
      for (const section of romaneioSections) {
        if (section.includes('ROMANEIO:')) {
          pages.push(section.trim());
        }
      }
    }

    // If still no pages, try using AI to parse
    if (pages.length === 0) {
      // Return the raw PDF indication that we need client-side parsing
      console.log('Could not extract text directly, returning base64 for client processing');
      
      // Alternative: Use document parsing API
      // For now, return empty to indicate we need the document parser
      return new Response(
        JSON.stringify({
          success: true,
          pages: [],
          needsDocumentParser: true,
          message: 'PDF requires document parser for text extraction'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted ${pages.length} romaneio pages`);

    return new Response(
      JSON.stringify({
        success: true,
        pages,
        pageCount: pages.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error processing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
