import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, RegisterRequest } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  username = '';
  password = '';
  role: 'employee' = 'employee'; // lock role for now
  error = '';
  success = '';
  isLoading = false;

  constructor(private auth: AuthService, private router: Router) {}

  register() {
    this.error = '';
    this.success = '';

    if (!this.username || !this.password) {
      this.error = 'All fields are required';
      return;
    }
    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters long';
      return;
    }

    this.isLoading = true;

    const payload: RegisterRequest = {
      username: this.username.trim(),
      password: this.password,
      role: this.role
    };

    this.auth.register(payload).subscribe({
      next: (response: any) => {
        console.log('Registration response:', response);
        this.success = 'Registration successful! Redirecting to login...';
        this.isLoading = false;
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (error: any) => {
        console.error('Registration error:', error);
        this.isLoading = false;
        if (error.error && error.error.error) {
          this.error = error.error.error;
        } else if (error.status === 400) {
          this.error = 'Registration failed: Invalid data provided';
        } else if (error.status === 0) {
          this.error = 'Cannot connect to server. Please check if the server is running.';
        } else {
          this.error = 'Registration failed. Please try again.';
        }
      }
    });
  }

  clearMessages() {
    this.error = '';
    this.success = '';
  }
}
