import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';

export interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  remarks: string;
  start_date: string;
  end_date: string;
  leave_type?: 'sick' | 'medical' | 'privileged';
}

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private apiUrl = environment.apiBase; // use relative base (/api)

  constructor(private http: HttpClient, private auth: AuthService) {}

  // --------- Manager helper ----------
  createEmployee(username: string, password: string) {
    return this.http.post(`${this.apiUrl}/create_employee`, { username, password });
  }

  // --------- Employee APIs ----------
  myLeaves(): Observable<LeaveRequest[]> {
    const employeeId = this.auth.getEmployeeId();
    if (!employeeId) return throwError(() => new Error('Employee ID not found.'));
    return this.http.get<LeaveRequest[]>(`${this.apiUrl}/my_leaves/${employeeId}`);
  }

  applyLeave(leaveData: {
    start_date: string;
    end_date: string;
    reason: string;
    leave_type?: 'sick' | 'medical' | 'privileged';
  }): Observable<any> {
    const employeeId = this.auth.getEmployeeId();
    if (!employeeId) return throwError(() => new Error('Employee ID not found.'));
    const payload = { ...leaveData, employee_id: Number(employeeId) };
    return this.http.post(`${this.apiUrl}/apply_leave`, payload);
  }

  deleteLeave(leaveId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete_leave/${leaveId}`);
  }

  getLeaveBalance(): Observable<{ sick: number; medical: number; privileged: number }> {
    const employeeId = this.auth.getEmployeeId();
    if (!employeeId) return throwError(() => new Error('Employee ID not found.'));
    return this.http.get<{ sick: number; medical: number; privileged: number }>(
      `${this.apiUrl}/leave_balance/${employeeId}`
    );
  }

  // --------- Manager APIs ----------
  getAllLeaves(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/all_leaves`);
  }

  updateLeaveStatus(
    leaveId: number,
    status: 'Approved' | 'Rejected',
    remarks: string
  ): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.put(`${this.apiUrl}/update_leave/${leaveId}`, { status, remarks }, { headers });
  }

  getEmployeeBalances(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/employee_balances`);
  }

  getPendingEmployees(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/pending_employees`);
  }

  approveEmployee(userId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/approve_employee/${userId}`, {});
  }

  getEmployees(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/employees`);
  }

  getStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/leave_statistics`);
  }
}
