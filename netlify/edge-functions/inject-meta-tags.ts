import type { Context } from "@netlify/edge-functions";

interface TenantConfig {
  business_name?: string;
  intro_text?: string;
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

  // Skip edge function on localhost to avoid interfering with development
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    console.log('[inject-meta-tags] Skipping on localhost');
    return response;
  }

  const pathParts = url.pathname.split('/').filter(part => part.length > 0);
  
  // Check if this is a contact route with an ID
  let tenantId: string | null = null;

  if (url.searchParams.has('id')) {
      tenantId = url.searchParams.get('id');
      console.log('Tenant ID found in query param:', tenantId);
    }

  else if (pathParts.length >= 2 && pathParts[0] === 'contact') {
    tenantId = pathParts[1];
    console.log('Tenant ID found in path:', tenantId);
  }

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

    // Replace <title> if business_name is available
    if (tenantConfig.business_name) {
      modifiedHtml = modifiedHtml.replace(
        /<title>.*?<\/title>/i,
        `<title>${escapeHtml(tenantConfig.business_name)}</title>`
      );
    }

    // Replace meta name="title" if business_name is available
    if (tenantConfig.business_name) {
      modifiedHtml = modifiedHtml.replace(
        /<meta name="title" content="[^"]*">/i,
        `<meta name="title" content="${escapeHtml(tenantConfig.business_name)}">`
      );
    }

    // Replace meta name="description" if intro_text is available
    if (tenantConfig.meta_description) {
      modifiedHtml = modifiedHtml.replace(
        /<meta name="description" content="[^"]*">/i,
        `<meta name="description" content="${escapeHtml(tenantConfig.meta_description)}">`
      );
    }

    // Replace meta name="keywords" if meta_keywords is available
    if (tenantConfig.meta_keywords) {
      modifiedHtml = modifiedHtml.replace(
        /<meta name="keywords" content="[^"]*">/i,
        `<meta name="keywords" content="${escapeHtml(tenantConfig.meta_keywords)}">`
      );
    }

    // Replace meta name="author" if business_name is available
    if (tenantConfig.business_name) {
      modifiedHtml = modifiedHtml.replace(
        /<meta name="author" content="[^"]*">/i,
        `<meta name="author" content="${escapeHtml(tenantConfig.business_name)}">`
      );
    }

    // Replace Open Graph title if business_name is available
    if (tenantConfig.business_name) {
      modifiedHtml = modifiedHtml.replace(
        /<meta property="og:title" content="[^"]*">/i,
        `<meta property="og:title" content="${escapeHtml(tenantConfig.business_name)}">`
      );
    }

    // Replace Open Graph description if meta_description is available
    if (tenantConfig.meta_description) {
      modifiedHtml = modifiedHtml.replace(
        /<meta property="og:description" content="[^"]*">/i,
        `<meta property="og:description" content="${escapeHtml(tenantConfig.meta_description)}">`
      );
    }

    // Replace Open Graph image if meta_tag_image is available
    if (tenantConfig.meta_tag_image) {
      modifiedHtml = modifiedHtml.replace(
        /<meta property="og:image" content="[^"]*">/i,
        `<meta property="og:image" content="${escapeHtml(tenantConfig.meta_tag_image)}">`
      );
    }

    // Replace Open Graph site_name if business_name is available
    if (tenantConfig.business_name) {
      modifiedHtml = modifiedHtml.replace(
        /<meta property="og:site_name" content="[^"]*">/i,
        `<meta property="og:site_name" content="${escapeHtml(tenantConfig.business_name)}">`
      );
    }

    // Replace Twitter card image if meta_tag_image is available
    if (tenantConfig.meta_tag_image) {
      modifiedHtml = modifiedHtml.replace(
        /<meta property="twitter:card" content="[^"]*">/i,
        `<meta property="twitter:card" content="summary_large_image">`
      );
      modifiedHtml = modifiedHtml.replace(
        /<meta property="twitter:image" content="[^"]*">/i,
        `<meta property="twitter:image" content="${escapeHtml(tenantConfig.meta_tag_image)}">`
      );
    }

    // Replace Twitter title if business_name is available
    if (tenantConfig.business_name) {
      modifiedHtml = modifiedHtml.replace(
        /<meta property="twitter:title" content="[^"]*">/i,
        `<meta property="twitter:title" content="${escapeHtml(tenantConfig.business_name)}">`
      );
    }

    // Replace Twitter description if intro_text is available
    if (tenantConfig.intro_text) {
      modifiedHtml = modifiedHtml.replace(
        /<meta property="twitter:description" content="[^"]*">/i,
        `<meta property="twitter:description" content="${escapeHtml(tenantConfig.intro_text)}">`
      );
    }

    // Replace apple-mobile-web-app-title if business_name is available
    if (tenantConfig.business_name) {
      modifiedHtml = modifiedHtml.replace(
        /<meta name="apple-mobile-web-app-title" content="[^"]*">/i,
        `<meta name="apple-mobile-web-app-title" content="${escapeHtml(tenantConfig.business_name)}">`
      );
    }

    console.log('Meta tags updated successfully for tenant:', tenantId);

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