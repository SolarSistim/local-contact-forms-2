import type { Context } from "@netlify/edge-functions";

interface TenantConfig {
  business_name?: string;
  intro_text?: string;
  meta_description?: string;
  meta_keywords?: string;
  meta_tag_image?: string;
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  
  // Only track analytics for actual user page visits (not internal function calls)
  const isInternalRequest = url.pathname.startsWith('/.netlify/');
  const userAgent = request.headers.get('user-agent') || '';
  const isDeno = userAgent.includes('Deno/');
  
  // Fire off analytics tracking only for real user visits
  if (!isInternalRequest && !isDeno) {
    trackPageVisit(request, context).catch(err => {
      console.error('Analytics tracking error (non-blocking):', err);
    });
  }

  // Get the original response
  const response = await context.next();

  // Only process HTML requests
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("text/html")) {
    return response;
  }

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
    if (tenantConfig.meta_description) {
      modifiedHtml = modifiedHtml.replace(
        /<meta property="twitter:description" content="[^"]*">/i,
        `<meta property="twitter:description" content="${escapeHtml(tenantConfig.meta_description)}">`
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

// Async function to track page visits (fire and forget)
async function trackPageVisit(request: Request, context: Context) {
  try {
    const url = new URL(request.url);
    
    // Extract tenant ID
    const pathParts = url.pathname.split('/').filter(part => part.length > 0);
    let tenantId: string | null = null;
    
    if (url.searchParams.has('id')) {
      tenantId = url.searchParams.get('id');
    } else if (pathParts.length >= 2 && pathParts[0] === 'contact') {
      tenantId = pathParts[1];
    }

    // Skip analytics if no tenant ID
    if (!tenantId) {
      return;
    }

    // Get current date/time in CST format
    const date = new Date();
    const cstDate = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(date);

    // Get referrer
    const referrer = request.headers.get('referer') || 'Direct';

    // Get geographic location from Netlify context
    const geo = context.geo;
    const geoLocation = geo ? `${geo.city || 'Unknown'}, ${geo.subdivision?.name || geo.country?.name || 'Unknown'}` : 'Unknown';

    // Get IP address
    const ip = context.ip || request.headers.get('x-forwarded-for') || 'Unknown';

    // Get page URL/path
    const pageUrl = url.pathname + url.search;

    // Parse User Agent for device type and platform
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const deviceType = getDeviceType(userAgent);
    const platform = getPlatform(userAgent);

    // Generate session ID (simple hash of IP + UA + date)
    const sessionId = await generateSessionId(ip, userAgent, date.toDateString());

    // Prepare analytics data
    const analyticsData = {
      tenantId,
      date: cstDate,
      referrer,
      geoLocation,
      ip,
      pageUrl,
      deviceType,
      sessionId,
      platform,
      userAgent
    };

    // Send to Google Sheets via Netlify function
    const analyticsUrl = `${url.origin}/.netlify/functions/log-analytics`;
    
    // Fire and forget - don't await
    fetch(analyticsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analyticsData)
    }).catch(err => {
      console.error('Failed to send analytics (non-blocking):', err);
    });

  } catch (error) {
    console.error('Error in trackPageVisit (non-blocking):', error);
  }
}

// Helper function to determine device type
function getDeviceType(userAgent: string): string {
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
    return 'Mobile';
  } else if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    return 'Tablet';
  }
  return 'Desktop';
}

// Helper function to determine platform
function getPlatform(userAgent: string): string {
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/macintosh|mac os x/i.test(userAgent)) return 'Mac';
  if (/linux/i.test(userAgent)) return 'Linux';
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
  return 'Unknown';
}

// Helper function to generate a session ID
async function generateSessionId(ip: string, userAgent: string, date: string): Promise<string> {
  const data = `${ip}-${userAgent}-${date}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16); // Use first 16 chars
}

// Helper function to escape HTML special characters
function escapeHtml(text: string | undefined): string {
  if (!text) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}