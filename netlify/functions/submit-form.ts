import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables from .env file for local development
dotenv.config();

const sheets = google.sheets('v4');

// Configure nodemailer with Gmail
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
      range: 'tenants_master_sheet!A2:L1000',
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
    const configSheetId = tenantRow[3]; // config_sheet_id column

    // Fetch tenant config to get notify_submit and business_name
    const configResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: configSheetId,
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

    const notifyEmail = config.notify_on_submit;
    const businessName = config.business_name;

    // Debug logging
    console.log('notifyEmail:', notifyEmail);
    console.log('GMAIL_USER:', process.env.GMAIL_USER);
    console.log('GMAIL_APP_PASSWORD exists:', !!process.env.GMAIL_APP_PASSWORD);

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
      range: 'submissions!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });

    // Send email notification via Gmail
    if (notifyEmail && process.env.GMAIL_USER) {
      try {
        await transporter.sendMail({
          from: `"Local Contact Forms" <${process.env.GMAIL_USER}>`,
          to: notifyEmail,
          subject: `New Contact Form Submission - ${businessName || 'Your Business'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563EB;">New Contact Form Submission</h2>
              <p><strong>Business:</strong> ${businessName || 'N/A'}</p>
              <p><strong>Received:</strong> ${timestamp}</p>

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
      console.warn('Email notification skipped - missing notifyEmail or Gmail credentials');
    }

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
