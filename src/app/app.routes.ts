import { Routes } from '@angular/router';
import { ContactForm } from './components/contact-form/contact-form';
import { PageHome } from './components/pages/page-home/page-home';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-route-resolver',
  standalone: true,
  template: ''
})
export class RouteResolverComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['id']) {
        this.router.navigate(['/contact', params['id']]);
      } else {
        this.router.navigate(['/home']);
      }
    });
  }
}

export const routes: Routes = [
  {
    path: '',
    component: ContactForm,
    pathMatch: 'full',
    data: { prerender: false }
  },
  {
    path: 'contact/:id',
    component: ContactForm,
    data: { prerender: false }
  },
  {
    path: 'home',
    component: PageHome
  }
];