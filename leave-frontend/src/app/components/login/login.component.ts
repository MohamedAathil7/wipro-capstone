import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  username: string = '';
  password: string = '';
  error: string = '';
  toastMessage = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['loggedOut']) {
        this.toastMessage = 'Successfully logged out';
        setTimeout(() => this.toastMessage = '', 3000);
      }
    });
  }

  login(): void {
    this.error = '';

    if (!this.username || !this.password) {
      this.error = 'All fields are required';
      return;
    }

    this.auth.login(this.username, this.password).subscribe(
      (res: any) => {
        if (res && res.role) {
          localStorage.setItem('username', res.username || this.username);
          localStorage.setItem('role', res.role);
          localStorage.setItem('emp_id', res.id?.toString() || '');

          if (res.role === 'manager') {
            this.router.navigate(['/manager']);
          } else {
            this.router.navigate(['/employee']);
          }
        } else {
          this.error = 'Unexpected response from server.';
        }
      },
      (err: HttpErrorResponse) => {
        if (err.error && err.error.error) {
          this.error = err.error.error;
        } else if (err.status === 401 || err.status === 403) {
          this.error = 'Invalid username or password.';
        } else {
          this.error = 'Login failed. Could not connect to the server.';
        }
      }
    );
  }

  logout(): void {
    this.auth.logout();
  }
}
