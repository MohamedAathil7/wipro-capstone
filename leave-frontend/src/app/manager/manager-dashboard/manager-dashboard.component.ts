import { Component, OnInit } from '@angular/core';
import { LeaveService } from '../../services/leave.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-manager-dashboard',
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css']
})
export class ManagerDashboardComponent implements OnInit {
  username = '';
  currentView: 'dashboard' | 'approvals' | 'all-leaves' | 'balances' | 'employees' | 'create-employee' = 'dashboard';

  leaves: any[] = [];
  allLeaves: any[] = [];
  pendingLeaves: any[] = [];
  employeeBalances: { username: string; sick: number; medical: number; privileged: number }[] = [];
  pendingEmployees: { id: number; username: string }[] = [];
  loading = false;
  error = '';
  toastMessage = '';
  currentYear = new Date().getFullYear();
    greeting: string = '';

  newEmployee = { username: '', password: '' };

  constructor(private leaveService: LeaveService, private router: Router) {}

  ngOnInit(): void {
    this.username = localStorage.getItem('username') || 'Manager';
    this.loadAllLeaves();
    this.loadPendingEmployees();
      this.setGreeting();
  }

  
  setGreeting() {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istOffset = 5.5 * 60 * 60000;
    const istTime = new Date(utcTime + istOffset);
    const hours = istTime.getHours();

    if (hours >= 5 && hours < 12) {
      this.greeting = 'Good Morning';
    } else if (hours >= 12 && hours < 17) {
      this.greeting = 'Good Afternoon';
    } else if (hours >= 17 && hours < 21) {
      this.greeting = 'Good Evening';
    } else {
      this.greeting = 'Good Night';
    }
  }

  // ---------------- EMPLOYEE CREATION ----------------
  createEmployee(): void {
    if (!this.newEmployee.username || !this.newEmployee.password) {
      this.error = 'Username and password are required';
      return;
    }
    this.leaveService.createEmployee(this.newEmployee.username, this.newEmployee.password).subscribe({
      next: () => {
        this.showToast('Employee created successfully. Waiting for approval.');
        this.newEmployee = { username: '', password: '' };
        this.setView('employees'); // redirect to pending employees view
      },
      error: () => this.error = 'Failed to create employee'
    });
  }

  // ---------------- VIEW SWITCHER ----------------
  setView(view: 'dashboard' | 'approvals' | 'all-leaves' | 'balances' | 'employees' | 'create-employee') {
    this.currentView = view;
    this.error = '';
    this.toastMessage = '';
    switch (view) {
      case 'approvals':
        this.leaves = this.pendingLeaves;
        break;
      case 'all-leaves':
        this.leaves = this.allLeaves;
        break;
      case 'balances':
        this.loadEmployeeBalances();
        break;
      case 'employees':
        this.loadPendingEmployees();
        break;
    }
  }

  // ---------------- LEAVE MANAGEMENT ----------------
  loadAllLeaves(): void {
    this.loading = true;
    this.leaveService.getAllLeaves().subscribe({
      next: (res: any[]) => {
        this.allLeaves = res;
        this.leaves = res;
        this.pendingLeaves = res.filter(l => l.status === 'Pending');
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load leaves';
        this.loading = false;
      }
    });
  }

  approve(leave: any): void {
    this.updateLeaveStatus(leave.id, 'Approved', leave.remarks || 'Approved by manager');
  }

  reject(leave: any): void {
    this.updateLeaveStatus(leave.id, 'Rejected', leave.remarks || 'Rejected by manager');
  }

  updateLeaveStatus(leaveId: number, status: 'Approved' | 'Rejected', remarks: string): void {
    this.loading = true;
    this.leaveService.updateLeaveStatus(leaveId, status, remarks).subscribe({
      next: () => {
        this.showToast(`Leave ${status.toLowerCase()} successfully`);
        this.loadAllLeaves();
      },
      error: () => {
        this.error = 'Failed to update leave';
        this.loading = false;
      }
    });
  }

  // ---------------- BALANCES ----------------
  loadEmployeeBalances(): void {
    this.loading = true;
    this.leaveService.getEmployeeBalances().subscribe({
      next: (res) => {
        this.employeeBalances = res;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load balances';
        this.loading = false;
      }
    });
  }

  // ---------------- EMPLOYEE APPROVALS ----------------
  loadPendingEmployees(): void {
    this.leaveService.getPendingEmployees().subscribe({
      next: (res) => this.pendingEmployees = res,
      error: () => this.error = 'Failed to load pending employees'
    });
  }

  approveEmployee(userId: number): void {
    this.leaveService.approveEmployee(userId).subscribe({
      next: () => {
        this.showToast('Employee approved successfully');
        this.loadPendingEmployees();
      },
      error: () => this.error = 'Failed to approve employee'
    });
  }

  // ---------------- UTILITIES ----------------
  showToast(message: string): void {
    this.toastMessage = message;
    setTimeout(() => this.toastMessage = '', 3000);
  }

  logout(): void {
    localStorage.removeItem('username');
    this.showToast('Logged out successfully');
    setTimeout(() => this.router.navigate(['/login']), 1500);
  }
}
