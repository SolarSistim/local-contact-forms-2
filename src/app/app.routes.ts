import { Routes } from '@angular/router';
import { ContactForm } from './components/contact-form/contact-form';
import { DefaultTenantGuard } from './guards/default-tenant.guard';

export const routes: Routes = [
  {
    path: '',
    component: ContactForm,
    pathMatch: 'full',
    canActivate: [DefaultTenantGuard]
  }
];
