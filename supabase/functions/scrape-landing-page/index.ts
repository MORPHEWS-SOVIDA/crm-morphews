import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScrapeRequest {
  url: string;
  name?: string;
  category?: string;
  saveAsTemplate?: boolean; // Super Admin only
  saveAsLandingPage?: boolean; // Tenant
  organizationId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, name, category, saveAsTemplate, saveAsLandingPage, organizationId } = await req.json() as ScrapeRequest;

    if (!url) {
      throw new Error("URL é obrigatória");
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      throw new Error("Firecrawl não está configurado. Entre em contato com o suporte.");
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping URL:", formattedUrl);

    // Scrape the page with multiple formats
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown", "html", "screenshot", "branding", "links"],
        onlyMainContent: false, // Get full page
        waitFor: 3000, // Wait for dynamic content
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error("Firecrawl error:", errorText);
      throw new Error(`Erro ao acessar o site: ${scrapeResponse.status}`);
    }

    const scrapeData = await scrapeResponse.json();
    console.log("Scrape successful:", scrapeData.success);

    // Extract data (Firecrawl v1 nests in data object)
    const data = scrapeData.data || scrapeData;
    const markdown = data.markdown || "";
    const html = data.html || "";
    const screenshot = data.screenshot || "";
    const branding = data.branding || {};
    const metadata = data.metadata || {};

    // Parse content to extract structured data
    const parsedContent = parseContentFromMarkdown(markdown, html);
    
    // Extract branding info
    const extractedBranding = {
      colors: branding.colors || {},
      fonts: branding.fonts || [],
      logo: branding.logo || branding.images?.logo || null,
      colorScheme: branding.colorScheme || "light",
    };

    const result: Record<string, any> = {
      success: true,
      url: formattedUrl,
      name: name || metadata.title || "Landing Page Importada",
      
      // Structured content
      headline: parsedContent.headline || metadata.title || "",
      subheadline: parsedContent.subheadline || metadata.description || "",
      benefits: parsedContent.benefits || [],
      testimonials: parsedContent.testimonials || [],
      faq: parsedContent.faq || [],
      urgency_text: parsedContent.urgencyText || "",
      guarantee_text: parsedContent.guaranteeText || "",
      
      // Branding
      branding: extractedBranding,
      primary_color: extractedBranding.colors?.primary || "#8B5CF6",
      secondary_color: extractedBranding.colors?.secondary || null,
      logo_url: extractedBranding.logo,
      
      // Raw content for advanced editing
      full_html: html,
      screenshot: screenshot,
      
      // Metadata
      metadata: {
        title: metadata.title,
        description: metadata.description,
        sourceURL: metadata.sourceURL || formattedUrl,
      },
    };

    // If saving to database
    if (saveAsTemplate || saveAsLandingPage) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      if (saveAsTemplate) {
        // Save as template (Super Admin)
        const { data: template, error: templateError } = await supabaseAdmin
          .from("landing_page_templates")
          .insert({
            name: result.name,
            description: result.subheadline,
            category: category || "importado",
            source_url: formattedUrl,
            source_type: "scraped",
            headline: result.headline,
            subheadline: result.subheadline,
            benefits: result.benefits,
            testimonials: result.testimonials,
            faq: result.faq,
            urgency_text: result.urgency_text,
            guarantee_text: result.guarantee_text,
            logo_url: result.logo_url,
            primary_color: result.primary_color,
            secondary_color: result.secondary_color,
            full_html: result.full_html,
            branding: result.branding,
            thumbnail_url: result.screenshot,
            is_active: true,
            is_featured: false,
          })
          .select()
          .single();

        if (templateError) {
          console.error("Error saving template:", templateError);
          throw new Error("Erro ao salvar template");
        }

        result.templateId = template.id;
        console.log("Template saved:", template.id);
      }

      if (saveAsLandingPage && organizationId) {
        // Generate unique slug
        const baseSlug = (result.name || "imported")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .substring(0, 30);
        const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

        // Save as landing page for tenant
        const { data: landingPage, error: lpError } = await supabaseAdmin
          .from("landing_pages")
          .insert({
            organization_id: organizationId,
            name: result.name,
            slug: slug,
            headline: result.headline,
            subheadline: result.subheadline,
            benefits: result.benefits,
            testimonials: result.testimonials,
            faq: result.faq,
            urgency_text: result.urgency_text,
            guarantee_text: result.guarantee_text,
            logo_url: result.logo_url,
            primary_color: result.primary_color,
            custom_css: "",
            is_active: false, // Start inactive for review
            settings: {
              imported_from: formattedUrl,
              branding: result.branding,
            },
          })
          .select()
          .single();

        if (lpError) {
          console.error("Error saving landing page:", lpError);
          throw new Error("Erro ao salvar landing page");
        }

        result.landingPageId = landingPage.id;
        result.landingPageSlug = landingPage.slug;
        console.log("Landing page saved:", landingPage.id);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error scraping:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Parse markdown/html to extract structured landing page content
function parseContentFromMarkdown(markdown: string, html: string): {
  headline: string;
  subheadline: string;
  benefits: { icon: string; title: string; description: string }[];
  testimonials: { name: string; role: string; text: string; avatar?: string }[];
  faq: { question: string; answer: string }[];
  urgencyText: string;
  guaranteeText: string;
} {
  const result = {
    headline: "",
    subheadline: "",
    benefits: [] as { icon: string; title: string; description: string }[],
    testimonials: [] as { name: string; role: string; text: string; avatar?: string }[],
    faq: [] as { question: string; answer: string }[],
    urgencyText: "",
    guaranteeText: "",
  };

  // Extract headline from first H1
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) {
    result.headline = h1Match[1].trim();
  }

  // Extract subheadline from first paragraph after H1
  const subMatch = markdown.match(/^#\s+.+\n+(.+?)(?:\n\n|\n#)/s);
  if (subMatch && subMatch[1].length < 300) {
    result.subheadline = subMatch[1].trim();
  }

  // Extract benefits from bullet lists
  const bulletMatches = markdown.matchAll(/^[-*]\s+\*?\*?(.+?)\*?\*?(?::\s*|\s*[-–]\s*)(.+)?$/gm);
  for (const match of bulletMatches) {
    if (result.benefits.length < 6) {
      result.benefits.push({
        icon: "✓",
        title: match[1].replace(/\*\*/g, "").trim(),
        description: match[2]?.trim() || "",
      });
    }
  }

  // Look for FAQ patterns
  const faqMatches = markdown.matchAll(/(?:^#+\s*|\*\*)(.+?\?)\*?\*?\n+(.+?)(?=\n\n|\n#+|\n\*\*|$)/gms);
  for (const match of faqMatches) {
    if (result.faq.length < 10 && match[1].includes("?")) {
      result.faq.push({
        question: match[1].replace(/\*\*/g, "").trim(),
        answer: match[2].trim().substring(0, 500),
      });
    }
  }

  // Look for guarantee keywords
  const guaranteeMatch = markdown.match(/(?:garantia|devolução|reembolso|risco).{0,200}/i);
  if (guaranteeMatch) {
    result.guaranteeText = guaranteeMatch[0].trim();
  }

  // Look for urgency keywords
  const urgencyMatch = markdown.match(/(?:últimas|vagas|limitad|escass|promo[çc][aã]o|oferta).{0,150}/i);
  if (urgencyMatch) {
    result.urgencyText = urgencyMatch[0].trim();
  }

  return result;
}
