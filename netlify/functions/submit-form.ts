import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables from .env file for local development
dotenv.config();

const sheets = google.sheets('v4');

// Configure nodemailer with Gmail (we'll guard usage later)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

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

  // Basic sanity log
  console.log('Incoming request to contact-form function');

  try {
    // ---- Parse and validate body ----
    let formData: FormSubmission;
    try {
      formData = JSON.parse(event.body || '{}');
    } catch (parseError: any) {
      console.error('Failed to parse request body as JSON:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    console.log('Parsed formData:', {
      tenantId: formData.tenantId,
      email: formData.email,
      hasRecaptcha: !!formData.recaptchaToken,
    });

    // Validate required fields
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.phone ||
      !formData.tenantId
    ) {
      console.warn('Missing required fields in form submission');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // ---- Verify reCAPTCHA (if provided) ----
    if (formData.recaptchaToken) {
      if (!process.env.RECAPTCHA_SECRET_KEY) {
        console.error('RECAPTCHA_SECRET_KEY is not set but recaptchaToken was provided');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Server misconfigured: reCAPTCHA secret missing' }),
        };
      }

      console.log('Verifying reCAPTCHA...');
      const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${formData.recaptchaToken}`,
      });

      console.log('reCAPTCHA response status:', recaptchaResponse.status);

      if (!recaptchaResponse.ok) {
        console.error('reCAPTCHA verification HTTP error:', recaptchaResponse.status);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Error verifying reCAPTCHA' }),
        };
      }

      const recaptchaResult = await recaptchaResponse.json();
      console.log('reCAPTCHA result:', recaptchaResult);

      if (!recaptchaResult.success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'reCAPTCHA verification failed' }),
        };
      }
    }

    // ---- Initialize Google Sheets API ----
    const serviceAccountKeyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKeyEnv) {
      console.error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server misconfigured: missing Google service account key' }),
      };
    }

    let serviceAccountCredentials: any;
    try {
      serviceAccountCredentials = JSON.parse(serviceAccountKeyEnv);
    } catch (parseError: any) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON:', parseError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server misconfigured: invalid Google service account key' }),
      };
    }

    console.log('Initializing GoogleAuth...');
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountCredentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    console.log('Getting Google auth client...');
    const authClient = await auth.getClient();
    console.log('Google auth client obtained');
    google.options({ auth: authClient as any });

    // ---- Get global config to find submission sheet ID ----
    const globalConfigSheetId = process.env.GLOBAL_CONFIG_SHEET_ID;
    if (!globalConfigSheetId) {
      console.error('GLOBAL_CONFIG_SHEET_ID is not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server misconfigured: global config sheet ID missing' }),
      };
    }

    console.log('Fetching global config from sheet:', globalConfigSheetId);
    const globalConfigResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: globalConfigSheetId,
      range: 'tenants_master_sheet!A2:L1000',
    });

    const globalRows = globalConfigResponse.data.values || [];
    console.log('Global config rows length:', globalRows.length);

    const tenantRow = globalRows.find((row) => row[0] === formData.tenantId);

    if (!tenantRow) {
      console.warn('Tenant not found for tenantId:', formData.tenantId);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' }),
      };
    }

    const testTenantValue = tenantRow[2]; // test_tenant column (TRUE/FALSE)
    const configSheetId = tenantRow[3]; // config_sheet_id column
    const submissionsSheetId = tenantRow[4]; // submissions_sheet_id column

    if (!configSheetId || !submissionsSheetId) {
      console.error('Missing configSheetId or submissionsSheetId for tenant:', formData.tenantId, {
        configSheetId,
        submissionsSheetId,
      });
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Server misconfigured: tenant sheet IDs missing',
        }),
      };
    }

    // ---- Fetch tenant config to get notify_submit and business_name ----
    console.log('Fetching tenant config from sheet:', configSheetId);
    const configResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: configSheetId,
      range: 'config!A2:B100',
    });

    const configRows = configResponse.data.values || [];
    const config: Record<string, string> = {};
    configRows.forEach((row: string[]) => {
      const key = row[0];
      const value = row[1];
      if (key && value !== undefined) {
        config[key] = value;
      }
    });

    const notifyEmail = config.notify_on_submit;
    const businessName = config.business_name;

    console.log('Tenant config loaded:', {
      notifyEmail,
      businessName,
    });

    // Debug logging of mail env
    console.log('GMAIL_USER set:', !!process.env.GMAIL_USER);
    console.log('GMAIL_APP_PASSWORD set:', !!process.env.GMAIL_APP_PASSWORD);

    // ---- Append submission to Google Sheet ----
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const now = new Date();
    const januaryOffset = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
    const julyOffset = new Date(now.getFullYear(), 6, 1).getTimezoneOffset();
    const isDST = Math.max(januaryOffset, julyOffset) !== now.getTimezoneOffset();
    const tzAbbreviation = isDST ? 'CDT' : 'CST';

    const timestampWithTZ = `${timestamp} ${tzAbbreviation}`;
    
    const rowData = [
      timestampWithTZ,
      formData.firstName,
      formData.lastName,
      formData.email,
      formData.phone,
      formData.reason,
      formData.message,
    ];

    console.log('Inserting submission row at top of sheet:', submissionsSheetId);
// First, get the spreadsheet to find the sheet ID
const spreadsheet = await sheets.spreadsheets.get({
  spreadsheetId: submissionsSheetId,
});

// Log all sheet names for debugging
const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
console.log('Available sheets in spreadsheet:', sheetNames);

// Find the submissions sheet ID (not the spreadsheet ID) - case insensitive
const submissionsSheet = spreadsheet.data.sheets?.find(
  sheet => sheet.properties?.title?.toLowerCase() === 'submissions'
);

if (!submissionsSheet?.properties || submissionsSheet.properties.sheetId === undefined) {
  console.error('Could not find submissions sheet. Available sheets:', sheetNames);
  throw new Error('Could not find submissions sheet');
}

const sheetId = submissionsSheet.properties.sheetId;

console.log('Found submissions sheet with ID:', sheetId);

// Insert a new row at position 1 (right after the header row at position 0)
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: submissionsSheetId,
  requestBody: {
    requests: [
      {
        insertDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: 1,
            endIndex: 2,
          },
        },
      },
    ],
  },
});

// Now write the data to row 2 (index 1, right after header)
await sheets.spreadsheets.values.update({
  spreadsheetId: submissionsSheetId,
  range: 'submissions!A2:G2',
  valueInputOption: 'USER_ENTERED',
  requestBody: {
    values: [rowData],
  },
});
console.log('Submission inserted at top successfully');

    // ---- Log submission to master tracking spreadsheet ----
    try {
      const masterTrackingSheetId = '1-j1qhdR0ERzDkJlgy1klls5ztJdbJMpHbLDfH6BXVQk';

      // Get user IP address
      const userIP = event.headers['x-forwarded-for']?.split(',')[0] ||
                     event.headers['x-nf-client-connection-ip'] ||
                     'unknown';

      // Parse user agent for platform info
      const userAgent = event.headers['user-agent'] || 'unknown';
      let platform = 'unknown';

      if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
        platform = 'Mobile';
      } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
        platform = 'Tablet';
      } else {
        platform = 'Desktop';
      }

      // Extract browser info
      let browser = 'unknown';
      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        browser = 'Chrome';
      } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browser = 'Safari';
      } else if (userAgent.includes('Firefox')) {
        browser = 'Firefox';
      } else if (userAgent.includes('Edg')) {
        browser = 'Edge';
      }

      const platformInfo = `${platform} - ${browser}`;

      // Prepare tracking row data
      const trackingRow = [
        `${timestampWithTZ}`,                                    // date
        `${businessName || formData.tenantId}`,                  // client
        `${notifyEmail || 'not set'}`,                           // to_address
        `${testTenantValue || 'FALSE'}`,                         // test_tenant
        `${userIP}`,                                             // ip_address
        `${platformInfo}`                                        // platform
        `${userAgent}`,                                          // browser_agent
      ];

      console.log('Logging to master tracking sheet:', masterTrackingSheetId);

      // Get the tracking spreadsheet to find the sheet ID
      const trackingSpreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: masterTrackingSheetId,
      });

      // Find the submissions tracking sheet
      const trackingSheet = trackingSpreadsheet.data.sheets?.find(
        sheet => sheet.properties?.title?.toLowerCase() === 'submissions' ||
                 sheet.properties?.title?.toLowerCase() === 'tracking' ||
                 sheet.properties?.title?.toLowerCase() === 'submit_history'
      );

      if (!trackingSheet?.properties || trackingSheet.properties.sheetId === undefined) {
        console.error('Could not find tracking sheet in master spreadsheet');
      } else {
        const trackingSheetId = trackingSheet.properties.sheetId;
        const trackingSheetName = trackingSheet.properties.title || 'submissions';

        // Insert a new row at position 1 (right after header)
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: masterTrackingSheetId,
          requestBody: {
            requests: [
              {
                insertDimension: {
                  range: {
                    sheetId: trackingSheetId,
                    dimension: 'ROWS',
                    startIndex: 1,
                    endIndex: 2,
                  },
                },
              },
            ],
          },
        });

        // Write the tracking data to row 2 (index 1, right after header)
        await sheets.spreadsheets.values.update({
          spreadsheetId: masterTrackingSheetId,
          range: `${trackingSheetName}!A2:G2`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [trackingRow],
          },
        });

        console.log('Master tracking entry logged successfully');
      }
    } catch (trackingError: any) {
      console.error('Failed to log to master tracking sheet:', trackingError);
      // Don't fail the entire submission if tracking fails
    }

    // ---- Send email notification via Gmail (best-effort) ----
    if (notifyEmail && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        console.log('Sending notification email to:', notifyEmail);
        await transporter.sendMail({
          from: `"Local Contact Forms" <${process.env.GMAIL_USER}>`,
          to: notifyEmail,
          subject: `New Contact Form Submission - ${businessName || 'Your Business'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563EB;">New Contact Form Submission</h2>
              <p><strong>Business:</strong> ${businessName || 'N/A'}</p>
              <p><strong>Received:</strong> ${timestampWithTZ}</p>

              <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">

              <h3 style="color: #374151;">Contact Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;"><strong>Name:</strong></td>
                  <td style="padding: 8px 0;">${formData.firstName} ${formData.lastName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Email:</strong></td>
                  <td style="padding: 8px 0;"><a href="mailto:${formData.email}" style="color: #2563EB;">${formData.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Phone:</strong></td>
                  <td style="padding: 8px 0;"><a href="tel:${formData.phone}" style="color: #2563EB;">${formData.phone}</a></td>
                </tr>
              </table>

              <h3 style="color: #374151; margin-top: 20px;">Inquiry Details</h3>
              <p><strong>Reason for Contact:</strong> ${formData.reason}</p>
              <p><strong>Message:</strong></p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 10px;">
                ${formData.message || 'No message provided'}
              </div>

              <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">

              <p style="color: #6b7280; font-size: 12px; text-align: center;">
                This email was sent from your <a href="https://www.localcontactforms.com" style="color: #2563EB;">Local Contact Forms</a> account.
              </p>
            </div>
          `,
        });

        console.log('Email notification sent to:', notifyEmail);
      } catch (emailError: any) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the entire submission if email fails
      }
    } else {
      console.warn('Email notification skipped - missing notifyEmail or Gmail credentials', {
        notifyEmail,
        hasGmailUser: !!process.env.GMAIL_USER,
        hasGmailPassword: !!process.env.GMAIL_APP_PASSWORD,
      });
    }

    // ---- Success response ----
    console.log('Form submission completed successfully');
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
