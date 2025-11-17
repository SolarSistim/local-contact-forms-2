import type { Context } from "@netlify/edge-functions";

interface TenantConfig {
  business_name?: string;
  meta_description?: string;
  meta_keywords?: string;
  meta_tag_image?: string;
}

export default async (request: Request, context: Context) => {
  // Get the original response
  const response = await context.next();

  // Only process HTML requests
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("text/html")) {
    return response;
  }

  // Get the tenant ID from query parameters
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("id");

  // If no tenant ID, return original response
  if (!tenantId) {
    return response;
  }

  try {
    // Fetch tenant configuration
    const tenantConfigUrl = `${url.origin}/.netlify/functions/get-tenant-config?id=${tenantId}`;
    console.log('Fetching tenant config from:', tenantConfigUrl);

    const configResponse = await fetch(tenantConfigUrl);

    if (!configResponse.ok) {
      console.error('Failed to fetch tenant config:', configResponse.status);
      const errorText = await configResponse.text();
      console.error('Error response:', errorText);
      return response;
    }

    const responseData = await configResponse.json();
    console.log('Response data received:', JSON.stringify(responseData));

    // The backend wraps the config in a 'config' property
    const tenantConfig: TenantConfig = responseData.config;

    if (!tenantConfig) {
      console.error('No config found in response');
      return response;
    }

    // Get the HTML text
    const html = await response.text();
    let modifiedHtml = html;

    // Only replace title if business_name exists
    if (tenantConfig.business_name) {
      console.log('Replacing title with:', tenantConfig.business_name);
      modifiedHtml = modifiedHtml.replace(
        /<title>.*?<\/title>/i,
        `<title>${escapeHtml(tenantConfig.business_name)}</title>`
      );
    }

    // Only replace meta description if it exists
    if (tenantConfig.meta_description) {
      console.log('Replacing meta description');
      modifiedHtml = modifiedHtml.replace(
        /<meta name="description" content=".*?">/i,
        `<meta name="description" content="${escapeHtml(tenantConfig.meta_description)}">`
      );
    }

    // Build Open Graph and other meta tags only for available fields
    const metaTags: string[] = [];

    if (tenantConfig.business_name) {
      metaTags.push(`<meta property="og:title" content="${escapeHtml(tenantConfig.business_name)}">`);
      metaTags.push(`<meta property="og:site_name" content="${escapeHtml(tenantConfig.business_name)}">`);
      metaTags.push(`<meta name="twitter:title" content="${escapeHtml(tenantConfig.business_name)}">`);
    }

    if (tenantConfig.meta_description) {
      metaTags.push(`<meta property="og:description" content="${escapeHtml(tenantConfig.meta_description)}">`);
      metaTags.push(`<meta name="twitter:description" content="${escapeHtml(tenantConfig.meta_description)}">`);
    }

    if (tenantConfig.meta_tag_image) {
      metaTags.push(`<meta property="og:image" content="${escapeHtml(tenantConfig.meta_tag_image)}">`);
      metaTags.push(`<meta name="twitter:image" content="${escapeHtml(tenantConfig.meta_tag_image)}">`);
    }

    if (tenantConfig.meta_keywords) {
      metaTags.push(`<meta name="keywords" content="${escapeHtml(tenantConfig.meta_keywords)}">`);
    }

    // Always add these if we have any tenant data
    if (metaTags.length > 0) {
      metaTags.push(`<meta property="og:type" content="website">`);
      metaTags.push(`<meta property="og:url" content="${url.toString()}">`);
      metaTags.push(`<meta name="twitter:card" content="summary_large_image">`);
    }

    // Insert meta tags before closing </head> if we have any
    if (metaTags.length > 0) {
      const metaTagsHtml = '\n  ' + metaTags.join('\n  ');
      modifiedHtml = modifiedHtml.replace(
        /<\/head>/i,
        `${metaTagsHtml}\n</head>`
      );
      console.log('Meta tags injected successfully for tenant:', tenantId);
    }

    // Return modified HTML
    return new Response(modifiedHtml, {
      headers: {
        ...response.headers,
        "content-type": "text/html; charset=utf-8",
      },
    });

  } catch (error) {
    console.error('Error in edge function:', error);
    return response;
  }
};

// Helper function to escape HTML special characters
function escapeHtml(text: string | undefined): string {
  if (!text) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}