import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { TenantConfig, FormSubmission } from '../models/tenant-config.model';

@Injectable({
  providedIn: 'root'
})
export class TenantConfigService {
  private readonly baseUrl = '/.netlify/functions';

  constructor(private http: HttpClient) {}

  /**
   * Fetches tenant configuration from Google Sheets via Netlify Function
   */
  getTenantConfig(tenantId: string): Observable<TenantConfig> {
    return this.http.get<{ config: TenantConfig }>(`${this.baseUrl}/get-tenant-config?id=${tenantId}`)
      .pipe(
        map(response => response.config),
        catchError(this.handleError)
      );
  }

  /**
   * Submits contact form data via Netlify Function
   */
  submitContactForm(formData: FormSubmission): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/submit-form`,
      formData
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Error handler for HTTP requests
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Backend returned an unsuccessful response code
      errorMessage = error.error?.message || `Server Error: ${error.status} - ${error.statusText}`;
    }

    console.error('TenantConfigService Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
