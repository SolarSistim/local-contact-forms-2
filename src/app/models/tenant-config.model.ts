export interface TenantConfig {
  // Business Information
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

  // Theme
  theme: string;

  // Form Configuration
  reason_for_contact: string; // Comma-separated values
  recaptcha_site_key?: string; // reCAPTCHA public site key
  show_email_on_phone?: string; // Yes/No to show email field on form
  show_phone_number_on_form?: string; // Yes/No to show phone field on form

  // Social Media URLs (all optional)
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

export interface GlobalTenantConfig {
  tenant_id: string;
  tenant_name: string;
  test_tenant: boolean;
  config_sheet_id: string;
  submissions_sheet_id: string;
  status: 'active' | 'inactive';
  created_at: string;
  owner_email: string;
  owner_first_name: string;
  owner_last_name: string;
  owner_phone_number: string;
  rate_limit_per_hour: number;
}

export interface FormSubmission {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  reason: string;
  message: string;
  tenantId: string;
  recaptchaToken?: string;
}
