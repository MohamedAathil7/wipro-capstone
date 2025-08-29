import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  username = '';
  password = '';
  error = '';
  success = '';

  constructor(private auth: AuthService, private router: Router) {}

  register() {
    this.error = '';
    this.success = '';

    if (!this.username || !this.password) {
      this.error = 'Username and password are required.';
      return;
    }

    this.auth.register({ username: this.username, password: this.password })
      .subscribe({
        next: (response) => {
          this.success = response.message || 'Registration successful! Waiting for approval.';
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err: HttpErrorResponse) => {
          if (err.error && err.error.error) {
            this.error = err.error.error; // Displays backend error e.g., "Username already exists"
          } else {
            this.error = 'An unknown registration error occurred. Please try again.';
          }
          console.error('Registration error:', err);
        }
      });
  }
}