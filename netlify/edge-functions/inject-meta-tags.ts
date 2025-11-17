import type { Context } from "@netlify/edge-functions";

interface TenantConfig {
  business_name: string;
  meta_description: string;
  meta_keywords: string;
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);

  // ✅ 1. If no tenant ID, redirect ONCE to the default
  const tenantId = url.searchParams.get("id");
  if (!tenantId) {
    url.searchParams.set("id", "local-contact-forms"); // 👈 your default slug
    // Important: this will NOT loop because the next request will HAVE ?id=...
    return Response.redirect(url.toString(), 302);
  }

  // ✅ 2. From here on, we KNOW we have an id -> just render page & inject meta
  const response = await context.next();

  // Only process HTML responses
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("text/html")) {
    return response;
  }

  try {
    // Fetch tenant configuration
    const tenantConfigUrl = `${url.origin}/.netlify/functions/get-tenant-config?id=${tenantId}`;
    console.log("Fetching tenant config from:", tenantConfigUrl);

    const configResponse = await fetch(tenantConfigUrl);

    if (!configResponse.ok) {
      console.error("Failed to fetch tenant config:", configResponse.status);
      const errorText = await configResponse.text();
      console.error("Error response:", errorText);
      return response;
    }

    const responseData = await configResponse.json();
    console.log("Response data received:", JSON.stringify(responseData));

    const tenantConfig: TenantConfig = responseData.config;

    if (!tenantConfig) {
      console.error("No config found in response");
      return response;
    }

    console.log("Business name:", tenantConfig.business_name);

    if (!tenantConfig.business_name || !tenantConfig.meta_description) {
      console.error("Tenant config missing required fields");
      return response;
    }

    // Get the HTML text
    const html = await response.text();
    let modifiedHtml = html;

    // Replace <title>
    modifiedHtml = modifiedHtml.replace(
      /<title>.*?<\/title>/i,
      `<title>${escapeHtml(tenantConfig.business_name)}</title>`
    );

    // Replace meta description (if one exists)
    modifiedHtml = modifiedHtml.replace(
      /<meta name="description" content=".*?">/i,
      `<meta name="description" content="${escapeHtml(
        tenantConfig.meta_description
      )}">`
    );

    // Open Graph + twitter + keywords
    const ogTags = `
  <meta property="og:title" content="${escapeHtml(
    tenantConfig.business_name
  )}">
  <meta property="og:description" content="${escapeHtml(
    tenantConfig.meta_description
  )}">
  <meta property="og:site_name" content="${escapeHtml(
    tenantConfig.business_name
  )}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url.toString()}">

  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(
    tenantConfig.business_name
  )}">
  <meta name="twitter:description" content="${escapeHtml(
    tenantConfig.meta_description
  )}">

  <meta name="keywords" content="${escapeHtml(tenantConfig.meta_keywords)}">`;

    // Insert OG tags before </head>
    modifiedHtml = modifiedHtml.replace(/<\/head>/i, `${ogTags}\n</head>`);

    console.log("Meta tags injected successfully for:", tenantConfig.business_name);

    return new Response(modifiedHtml, {
      headers: {
        ...response.headers,
        "content-type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error in edge function:", error);
    return response;
  }
};

function escapeHtml(text: string | undefined): string {
  if (!text) return "";
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
