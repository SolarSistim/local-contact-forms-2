import { Routes } from '@angular/router';
import { ContactForm } from './components/contact-form/contact-form';

export const routes: Routes = [
  {
    path: '',
    component: ContactForm,
    pathMatch: 'full'
  }
];