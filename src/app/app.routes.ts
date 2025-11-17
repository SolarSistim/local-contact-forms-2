import { Routes } from '@angular/router';
import { ContactForm } from './components/contact-form/contact-form';
import { PageHome } from './components/pages/page-home/page-home';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

// Create a resolver component
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
        // Has id parameter, navigate to contact form with params
        this.router.navigate(['/contact-form'], { queryParams: params });
      } else {
        // No id parameter, go to home
        this.router.navigate(['/home']);
      }
    });
  }
}

export const routes: Routes = [
  {
    path: '',
    component: RouteResolverComponent,
    pathMatch: 'full'
  },
  {
    path: 'contact-form',
    component: ContactForm
  },
  {
    path: 'home',
    component: PageHome
  }
];