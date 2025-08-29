import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface LoginResponse {
  id?: number;
  username?: string;
  role: 'manager' | 'employee';
}

export interface RegisterRequest {
  username: string;
  password: string;
  role: 'manager' | 'employee';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiBase;

  constructor(private router: Router, private http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    const endpoint = `${this.apiUrl}/login`;
    return this.http.post<LoginResponse>(endpoint, { username, password }).pipe(
      tap((response: LoginResponse) => {
        localStorage.setItem('token', 'dummy-token');
        localStorage.setItem('role', response.role);
        localStorage.setItem('username', response.username || username);
        if (response.id != null) localStorage.setItem('emp_id', String(response.id));
      }),
      catchError((error: any) => {
        console.error('Login error:', error);
        return throwError(() => new Error('Login failed'));
      })
    );
  }

  // 🔹 NEW REGISTER METHOD
  register(data: RegisterRequest): Observable<any> {
    const endpoint = `${this.apiUrl}/create_employee`;
    return this.http.post(endpoint, data).pipe(
      catchError((error: any) => {
        console.error('Register error:', error);
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/login'], { queryParams: { loggedOut: 'true' } });
  }

  getToken(): string | null { return localStorage.getItem('token'); }
  getRole(): string | null { return localStorage.getItem('role'); }
  getEmployeeId(): string | null { return localStorage.getItem('emp_id'); }
  getUsername(): string | null { return localStorage.getItem('username'); }
  isManager(): boolean { return this.getRole() === 'manager'; }
  isEmployee(): boolean { return this.getRole() === 'employee'; }
  isAuthenticated(): boolean { return !!this.getToken(); }
}
