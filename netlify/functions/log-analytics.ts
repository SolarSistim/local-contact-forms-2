import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

// Load environment variables from .env file for local development
dotenv.config();

const sheets = google.sheets('v4');

const SPREADSHEET_ID = '1-j1qhdR0ERzDkJlgy1klls5ztJdbJMpHbLDfH6BXVQk';
const SHEET_NAME = 'hit_counter';

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

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const analyticsData = JSON.parse(event.body || '{}');

    if (!analyticsData || !analyticsData.tenantId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid data format - missing required fields' })
      };
    }

    // Initialize Google Sheets API with service account
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch (parseError: any) {
      throw new Error(`Failed to parse service account key: ${parseError.message}`);
    }

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    google.options({ auth: authClient as any });

    // Prepare row data in the correct column order
    const rowData = [
      analyticsData.date,           // 1st column: Date
      analyticsData.tenantId,       // 2nd column: Tenant ID
      analyticsData.domain,         // 3rd column: Domain
      analyticsData.referrer,       // 4th column: Referrer
      analyticsData.geoLocation,    // 5th column: Geographic location
      analyticsData.ip,             // 6th column: IP address
      analyticsData.pageUrl,        // 7th column: Page URL/Path
      analyticsData.deviceType,     // 8th column: Device Type
      analyticsData.sessionId,      // 9th column: Session ID
      analyticsData.platform,       // 10th column: Platform
      analyticsData.userAgent       // 11th column: User Agent
    ];

    // Check if the sheet exists
    let sheetExists = false;

    try {
      const sheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const sheet = sheetMetadata.data.sheets?.find(
        s => s.properties?.title === SHEET_NAME
      );

      sheetExists = !!sheet;
    } catch (error) {
      console.log('Could not check sheet existence:', error);
    }

    // If sheet doesn't exist, create it with headers
    if (!sheetExists) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: SHEET_NAME,
                  },
                },
              },
            ],
          },
        });

        // Add headers
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              'Date',
              'Tenant ID',
              'Domain',
              'Referrer',
              'Geographic Location',
              'IP Address',
              'Page URL/Path',
              'Device Type',
              'Session ID',
              'Platform',
              'User Agent'
            ]],
          },
        });
      } catch (createError) {
        console.log('Sheet might already exist or could not be created:', createError);
      }
    }

    // Append data to the bottom of the sheet in a single atomic operation
    // This prevents blank rows that could occur with a two-step insert+update process
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:K`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Analytics logged successfully' })
    };

  } catch (error: any) {
    console.error('Error logging analytics:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to log analytics',
        details: error.message || 'Unknown error'
      })
    };
  }
};

export { handler };