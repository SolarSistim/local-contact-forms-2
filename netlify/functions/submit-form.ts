import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

// Load environment variables from .env file for local development
dotenv.config();

const sheets = google.sheets('v4');

interface FormSubmission {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  reason: string;
  message: string;
  tenantId: string;
  recaptchaToken?: string;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const formData: FormSubmission = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.tenantId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Verify reCAPTCHA
    if (formData.recaptchaToken) {
      const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${formData.recaptchaToken}`,
      });

      const recaptchaResult = await recaptchaResponse.json();

      if (!recaptchaResult.success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'reCAPTCHA verification failed' }),
        };
      }
    }

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    google.options({ auth: authClient as any });

    // Get global config to find submission sheet ID
    const globalConfigSheetId = process.env.GLOBAL_CONFIG_SHEET_ID;
    if (!globalConfigSheetId) {
      throw new Error('Global config sheet ID not configured');
    }

    const globalConfigResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: globalConfigSheetId,
      range: 'Sheet1!A2:L1000',
    });

    const globalRows = globalConfigResponse.data.values || [];
    const tenantRow = globalRows.find(row => row[0] === formData.tenantId);

    if (!tenantRow) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' }),
      };
    }

    const submissionsSheetId = tenantRow[4]; // submissions_sheet_id column
    const notifyEmail = tenantRow[7]; // owner_email column

    // Append submission to Google Sheet
    const timestamp = new Date().toLocaleString();
    const rowData = [
      timestamp,
      formData.firstName,
      formData.lastName,
      formData.email,
      formData.phone,
      formData.reason,
      formData.message,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: submissionsSheetId,
      range: 'Sheet1!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });

    // Send email notification (using Netlify's built-in email or external service)
    // Note: You'll need to implement email sending here
    // For example, using SendGrid, Mailgun, or Netlify's email service

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Form submitted successfully',
      }),
    };
  } catch (error: any) {
    console.error('Error submitting form:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

export { handler };
