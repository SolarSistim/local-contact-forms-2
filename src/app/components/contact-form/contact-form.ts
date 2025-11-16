import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Meta, Title } from '@angular/platform-browser';

import { TenantConfigService } from '../../services/tenant-config.service';
import { ThemeService } from '../../services/theme.service';
import { TenantConfig } from '../../models/tenant-config.model';
import { Loader } from '../loader/loader';
import { Message } from '../message/message';
import { AdaDialog } from '../legal-stuff/ada-dialog/ada-dialog';
import { TermsDialog } from '../legal-stuff/terms-dialog/terms-dialog';
import { PrivacyDialog } from '../legal-stuff/privacy-dialog/privacy-dialog';

declare const grecaptcha: any;

@Component({
  selector: 'app-contact-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule,
    Loader,
    Message
  ],
  templateUrl: './contact-form.html',
  styleUrl: './contact-form.scss',
})
export class ContactForm implements OnInit, OnDestroy {
  contactForm!: FormGroup;
  tenantConfig: TenantConfig | null = null;
  loading = true;
  submitting = false;
  success = false;
  error: string | null = null;
  reasonOptions: string[] = [];
  tenantId: string | null = null;
  private recaptchaWidgetId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private tenantConfigService: TenantConfigService,
    private themeService: ThemeService,
    private dialog: MatDialog,
    private meta: Meta,
    private title: Title,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.initializeForm();

    // Get tenant ID from query parameters
    // Try snapshot first for SSR, then subscribe for dynamic updates
    const snapshotId = this.route.snapshot.queryParams['id'];

    if (snapshotId) {
      this.tenantId = snapshotId;
      this.loadTenantConfig(snapshotId);
    }

    // Also subscribe to handle dynamic parameter changes in browser
    this.route.queryParams.subscribe(params => {
      const paramId = params['id'];
      if (paramId && paramId !== this.tenantId) {
        this.tenantId = paramId;
        this.loadTenantConfig(paramId);
      } else if (!paramId && !snapshotId && !this.tenantConfig) {
        // Only show error if no ID found and no config loaded
        this.error = 'No tenant ID provided. Please check your URL.';
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up reCAPTCHA if it exists
    if (isPlatformBrowser(this.platformId) && this.recaptchaWidgetId !== null && typeof grecaptcha !== 'undefined') {
      try {
        grecaptcha.reset(this.recaptchaWidgetId);
      } catch (e) {
        console.error('Error resetting reCAPTCHA:', e);
      }
    }
  }

  private initializeForm(): void {
    this.contactForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(1)]],
      lastName: ['', [Validators.required, Validators.minLength(1)]],
      email: ['', [Validators.required, this.emailValidator]],
      phone: ['', [Validators.required, this.phoneValidator]],
      reason: ['', Validators.required],
      message: [''],
      website: [''], // Honeypot field
      recaptchaToken: ['', Validators.required]
    });
  }

  private emailValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(control.value) ? null : { invalidEmail: true };
  }

  private phoneValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    // Remove all non-digit characters
    const digitsOnly = control.value.replace(/\D/g, '');

    if (!/^\d+$/.test(digitsOnly)) {
      return { invalidPhone: true };
    }
    if (digitsOnly.length !== 10) {
      return { phoneLength: true };
    }
    return null;
  }

  private loadTenantConfig(tenantId: string): void {
    this.loading = true;
    this.error = ''; // Clear any previous errors
    this.tenantConfigService.getTenantConfig(tenantId).subscribe({
      next: (config) => {
        this.tenantConfig = config;
        this.reasonOptions = config.reason_for_contact.split(',').map(r => r.trim());

        // Apply theme
        this.themeService.applyTheme(config.theme as any);

        // Update meta tags for SEO
        this.updateMetaTags(config);

        // Hide loading so form can render
        this.loading = false;

        // Initialize reCAPTCHA after form renders
        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => this.initializeRecaptcha(), 100);
        }
      },
      error: (err) => {
        this.error = err.message || 'Failed to load tenant configuration';
        this.loading = false;
      }
    });
  }

  private updateMetaTags(config: TenantConfig): void {
    this.title.setTitle(config.business_name);
    this.meta.updateTag({ name: 'description', content: config.meta_description });
    this.meta.updateTag({ name: 'keywords', content: config.meta_keywords });
  }

  private initializeRecaptcha(): void {
    console.log('🔴 initializeRecaptcha called');
    console.log('🔴 grecaptcha defined?', typeof grecaptcha !== 'undefined');
    console.log('🔴 site key:', this.tenantConfig?.recaptcha_site_key);
    console.log('🔴 element exists?', !!document.getElementById('recaptcha-element'));
    console.log('🔴 widget already created?', this.recaptchaWidgetId);

    if (typeof grecaptcha === 'undefined') {
      console.warn('⚠️ reCAPTCHA not loaded yet, retrying...');
      setTimeout(() => this.initializeRecaptcha(), 500);
      return;
    }

    if (!this.tenantConfig?.recaptcha_site_key) {
      console.error('❌ reCAPTCHA site key not available in config');
      return;
    }

    const element = document.getElementById('recaptcha-element');
    if (!element) {
      console.error('❌ reCAPTCHA element not found in DOM');
      return;
    }

    if (this.recaptchaWidgetId) {
      console.log('✅ reCAPTCHA already initialized');
      return;
    }

    try {
      console.log('🔵 Rendering reCAPTCHA...');
      this.recaptchaWidgetId = grecaptcha.render('recaptcha-element', {
        sitekey: this.tenantConfig.recaptcha_site_key,
        callback: (token: string) => {
          this.contactForm.patchValue({ recaptchaToken: token });
        },
        'expired-callback': () => {
          this.contactForm.patchValue({ recaptchaToken: '' });
        }
      });
      console.log('✅ reCAPTCHA rendered successfully!');
    } catch (e) {
      console.error('❌ Error initializing reCAPTCHA:', e);
    }
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    // Check honeypot
    if (this.contactForm.value.website) {
      console.log('Honeypot triggered - likely spam');
      this.success = true;
      return;
    }

    this.submitting = true;
    this.error = null;

    const formData = {
      firstName: this.contactForm.value.firstName,
      lastName: this.contactForm.value.lastName,
      email: this.contactForm.value.email,
      phone: this.contactForm.value.phone,
      reason: this.contactForm.value.reason,
      message: this.contactForm.value.message,
      tenantId: this.tenantId!,
      recaptchaToken: this.contactForm.value.recaptchaToken
    };

    this.tenantConfigService.submitContactForm(formData).subscribe({
      next: (response) => {
        this.success = true;
        this.submitting = false;
        this.contactForm.reset();
      },
      error: (err) => {
        this.error = err.message || 'Failed to submit form';
        this.submitting = false;

        // Reset reCAPTCHA on error
        if (isPlatformBrowser(this.platformId) && this.recaptchaWidgetId !== null) {
          grecaptcha.reset(this.recaptchaWidgetId);
        }
      }
    });
  }

  copyToClipboard(text: string): void {
    if (isPlatformBrowser(this.platformId)) {
      navigator.clipboard.writeText(text).then(() => {
        console.log('Copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  }

  copyAddressToClipboard(): void {
    if (!this.tenantConfig) return;

    const address = `${this.tenantConfig.business_address_1}${this.tenantConfig.business_address_2 ? ', ' + this.tenantConfig.business_address_2 : ''}, ${this.tenantConfig.business_city}, ${this.tenantConfig.business_state} ${this.tenantConfig.business_zip}`;
    this.copyToClipboard(address);
  }

  hasSocialMedia(): boolean {
    if (!this.tenantConfig) return false;

    return !!(
      this.tenantConfig.facebook_url ||
      this.tenantConfig.instagram_url ||
      this.tenantConfig.linkedin_url ||
      this.tenantConfig.pinterest_url ||
      this.tenantConfig.reddit_url ||
      this.tenantConfig.tiktok_url ||
      this.tenantConfig.wechat_url ||
      this.tenantConfig.x_url ||
      this.tenantConfig.youtube_url
    );
  }

  openPolicyDialog(type: 'ada' | 'terms' | 'privacy'): void {
  const dialogConfig = {
    width: '800px',
    maxWidth: '95vw',
    panelClass: 'policy-dialog-panel',
    autoFocus: false, // 👈 add this
    data: {
      title:
        type === 'ada'
          ? 'ADA Statement'
          : type === 'terms'
          ? 'Terms of Service'
          : 'Privacy Policy',
      clientName: this.tenantConfig?.business_name || 'our client'
    }
  };

  let dialogComponent;
  if (type === 'ada') {
    dialogComponent = AdaDialog;
  } else if (type === 'terms') {
    dialogComponent = TermsDialog;
  } else {
    dialogComponent = PrivacyDialog;
  }

  this.dialog.open(dialogComponent, dialogConfig);
}

}
