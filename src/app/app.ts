import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ContactForm } from './components/contact-form/contact-form';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ContactForm],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
