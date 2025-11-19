import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

// Load environment variables from .env file for local development
dotenv.config();

const sheets = google.sheets('v4');

interface TenantConfig {
  business_name: string;
  notify_on_submit: string;
  intro_text: string;
  meta_description: string;
  meta_keywords: string;
  post_submit_message: string;
  business_phone: string;
  business_address_1: string;
  business_address_2?: string;
  business_city: string;
  business_state: string;
  business_zip: string;
  business_web_url?: string;
  theme: string;
  reason_for_contact: string;
  facebook_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  pinterest_url?: string;
  reddit_url?: string;
  tiktok_url?: string;
  wechat_url?: string;
  x_url?: string;
  youtube_url?: string;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Accept both 'id' and 'tenantId' for backwards compatibility
    const tenantId = event.queryStringParameters?.id || event.queryStringParameters?.tenantId;

    if (!tenantId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Tenant ID is required (use ?id=xxx or ?tenantId=xxx)' }),
      };
    }

    // Debug logging
    console.log('Environment variable exists:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    console.log('Environment variable length:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.length);
    console.log('First 100 chars:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.substring(0, 100));

    // Initialize Google Sheets API with service account
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
      console.log('Parsed credentials, has client_email:', !!credentials.client_email);
    } catch (parseError: any) {
      throw new Error(`Failed to parse service account key: ${parseError.message}`);
    }

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    google.options({ auth: authClient as any });

    // Get global config sheet ID from environment variable
    const globalConfigSheetId = process.env.GLOBAL_CONFIG_SHEET_ID;

    if (!globalConfigSheetId) {
      throw new Error('Global config sheet ID not configured');
    }

    // Fetch tenant info from global config
    const globalConfigResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: globalConfigSheetId,
      range: 'tenants_master_sheet!A2:L1000', // Adjust range as needed
    });

    const globalRows = globalConfigResponse.data.values || [];
    const tenantRow = globalRows.find(row => row[0] === tenantId);

    if (!tenantRow) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' }),
      };
    }

    const submissionsSheetId = tenantRow[3];

    if (!submissionsSheetId) {
      throw new Error('Tenant submissions sheet ID not configured');
    }

    const configResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: submissionsSheetId,
      range: 'config!A2:B100',
    });

    const configRows = configResponse.data.values || [];
    const config: any = {};

    configRows.forEach((row: string[]) => {
      const key = row[0];
      const value = row[1];
      if (key && value !== undefined) {
        config[key] = value;
      }
    });

    // Add reCAPTCHA site key to config (public key, safe to expose)
    config.recaptcha_site_key = process.env.RECAPTCHA_SITE_KEY || '';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ config }),
    };
  } catch (error: any) {
    console.error('Error fetching tenant config:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

export { handler };
