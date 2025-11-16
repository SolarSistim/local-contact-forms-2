# Local Contact Forms 2.0

A multi-tenant Angular contact form platform with server-side rendering, Google Sheets integration, and Netlify Functions.

## Features

- **Multi-Tenant Architecture**: Each tenant gets a customized contact form
- **Server-Side Rendering (SSR)**: Dynamic meta tags for SEO
- **7 Pre-built Themes**: Fern, Lilac, Lemoncello, Sapphire, Crimson, Light, Dark
- **Google Sheets Integration**: Configuration and submissions stored in Google Sheets
- **Material Design**: Clean, professional UI with Angular Material
- **reCAPTCHA Protection**: Spam prevention with Google reCAPTCHA
- **Honeypot Field**: Additional spam filtering
- **Responsive Design**: Mobile-first approach
- **Form Validation**: Custom validators for email and phone
- **Social Media Integration**: Support for 9 social platforms
- **Policy Dialogs**: ADA Statement, Terms of Service, Privacy Policy

## Prerequisites

- Node.js 20 or higher
- npm or yarn
- Google Cloud Platform account with Sheets API enabled
- Netlify account
- reCAPTCHA keys (v2)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Google Sheets Setup

1. Create a Google Cloud Platform project
2. Enable Google Sheets API
3. Create a service account and download the JSON key
4. Create three types of Google Sheets:
   - **Global Config Sheet**: Tenant registry (one sheet)
   - **Tenant Config Sheets**: One per tenant for settings
   - **Submissions Sheets**: One per tenant for form data

#### Global Config Sheet Structure
Columns: `tenant_id | tenant_name | test_tenant | config_sheet_id | submissions_sheet_id | status | created_at | owner_email | owner_first_name | owner_last_name | owner_phone_number | rate_limit_per_hour`

#### Tenant Config Sheet Structure
Two columns: `Key | Value`

Required keys:
- business_name
- notify_on_submit
- intro_text
- meta_description
- meta_keywords
- post_submit_message
- business_phone
- business_address_1
- business_city
- business_state
- business_zip
- theme (Fern, Lilac, Lemoncello, Sapphire, Crimson, Light, or Dark)
- reason_for_contact (comma-separated values)

### 3. Environment Variables

Create a `.env` file in the root directory (use `.env.example` as template):

```env
GOOGLE_SERVICE_ACCOUNT_KEY={"type": "service_account","project_id": "..."}
GLOBAL_CONFIG_SHEET_ID=your_global_config_sheet_id
RECAPTCHA_SITE_KEY=your_recaptcha_site_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

### 4. Development

Run the development server with Netlify Functions:

```bash
npm run dev
```

This command starts:
- Angular dev server on port 4200
- Netlify Functions on port 8888

Access the app at: `http://localhost:8888/?id=your-tenant-id`

### 5. Build for Production

```bash
npm run build:ssr
```

### 6. Deploy to Netlify

1. Push code to GitHub
2. Connect repository to Netlify
3. Configure environment variables in Netlify dashboard
4. Deploy!

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── contact-form/       # Main contact form
│   │   ├── loader/             # Loading spinner
│   │   ├── message/            # Success/error messages
│   │   ├── ada-dialog/         # ADA statement dialog
│   │   ├── terms-dialog/       # Terms of service dialog
│   │   └── privacy-dialog/     # Privacy policy dialog
│   ├── models/
│   │   ├── tenant-config.model.ts
│   │   └── theme.model.ts
│   ├── services/
│   │   ├── tenant-config.service.ts
│   │   └── theme.service.ts
│   └── app.ts
├── styles/
│   └── dialog-styles.scss
└── styles.scss

netlify/
└── functions/
    ├── get-tenant-config.ts    # Fetch tenant configuration
    └── submit-form.ts          # Handle form submissions
```

## Available Themes

1. **Fern** - Forest green with golden accents
2. **Lilac** - Purple and blue tones
3. **Lemoncello** - Warm yellow theme
4. **Sapphire** - Blue and teal colors
5. **Crimson** - Deep red theme
6. **Light** - Clean light theme
7. **Dark** - Modern dark theme

## Usage

### Accessing a Tenant Form

```
https://your-domain.com/?id=tenant-id
```

Example: `https://localcontactforms.com/?id=ronnies-pizza-pace`

### Social Media Icons

Place social media icons in the `public/icons/` directory:
- icons8-facebook-50.png
- icons8-instagram-50.png
- icons8-linkedin-circled-50.png
- icons8-pinterest-50.png
- icons8-reddit-50.png
- icons8-tiktok-50.png
- icons8-wechat-50.png
- icons8-x-50.png
- icons8-youtube-50.png

## Security Features

- **reCAPTCHA v2**: Prevents automated submissions
- **Honeypot Field**: Hidden field to catch bots
- **CORS Protection**: Configured in Netlify Functions
- **Input Validation**: Client and server-side validation
- **Rate Limiting**: Per-tenant rate limits (configured in Google Sheets)

## Scripts

- `npm run dev` - Start development server with Netlify Functions
- `npm start` - Start Angular dev server only
- `npm run build` - Build for production
- `npm run build:ssr` - Build with SSR for production
- `npm test` - Run tests

## Notes

- Replace the test reCAPTCHA key in `contact-form.ts` with your actual site key
- Ensure all environment variables are set in Netlify before deploying
- The app uses Angular's standalone components (no NgModules)

## Support

For support, email: support@localcontactforms.com
