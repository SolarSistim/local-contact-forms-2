import type { Context } from "@netlify/edge-functions";

interface TenantConfig {
  business_name: string;
  meta_description: string;
  meta_keywords: string;
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

    console.log('Business name:', tenantConfig.business_name);

    // Validate that we have the required fields
    if (!tenantConfig.business_name || !tenantConfig.meta_description) {
      console.error('Tenant config missing required fields');
      return response;
    }

    // Get the HTML text
    const html = await response.text();

    // Replace title and meta description
    let modifiedHtml = html;

    // Replace title
    modifiedHtml = modifiedHtml.replace(
      /<title>.*?<\/title>/i,
      `<title>${escapeHtml(tenantConfig.business_name)}</title>`
    );

    // Replace meta description
    modifiedHtml = modifiedHtml.replace(
      /<meta name="description" content=".*?">/i,
      `<meta name="description" content="${escapeHtml(tenantConfig.meta_description)}">`
    );

    // Add Open Graph meta tags for better social media previews
    const ogTags = `
  <meta property="og:title" content="${escapeHtml(tenantConfig.business_name)}">
  <meta property="og:description" content="${escapeHtml(tenantConfig.meta_description)}">
  <meta property="og:site_name" content="${escapeHtml(tenantConfig.business_name)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url.toString()}">

  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(tenantConfig.business_name)}">
  <meta name="twitter:description" content="${escapeHtml(tenantConfig.meta_description)}">

  <meta name="keywords" content="${escapeHtml(tenantConfig.meta_keywords)}">`;

    // Insert OG tags before closing </head>
    modifiedHtml = modifiedHtml.replace(
      /<\/head>/i,
      `${ogTags}\n</head>`
    );

    console.log('Meta tags injected successfully for:', tenantConfig.business_name);

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
