import { Component, OnInit } from '@angular/core';
import { LeaveService } from '../../services/leave.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-employee-dashboard',
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.css']
})


export class EmployeeDashboardComponent implements OnInit {
  username = '';
  currentView: 'dashboard' | 'apply' | 'myLeaves' | 'approvals' | 'balances' = 'dashboard';

  newLeave = { 
    start_date: '', 
    end_date: '', 
    reason: '', 
    leave_type: 'sick' as 'sick' | 'medical' | 'privileged',
  };

  leaves: any[] = [];
  toastMessage: string = '';
  balance = { sick: 0, medical: 0, privileged: 0 };
  currentYear: number = new Date().getFullYear();
  greeting: string = '';
  numberOfDays: number = 0;
  leaveFilter: string = '';
filteredLeaves: any[] = [];

  constructor(private leaveService: LeaveService, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.username = localStorage.getItem('username') || 'Employee';
    this.loadLeaves();
    this.loadBalance();
    this.setGreeting();
  }

  calculateNumberOfDays() {
    if (this.newLeave.start_date && this.newLeave.end_date) {
      const start = new Date(this.newLeave.start_date);
      const end = new Date(this.newLeave.end_date);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
      this.numberOfDays = diffDays > 0 ? diffDays : 0;
    } else {
      this.numberOfDays = 0;
    }
  }
  calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive of both days
  return diffDays > 0 ? diffDays : 0;
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

  getLeaveType(reason: string): 'sick' | 'medical' | 'privileged' {
    if (reason === 'sick' || reason === 'Casual Leave') return 'sick';
    if (reason === 'Medical Emergency') return 'medical';
    return 'privileged';
  }

loadLeaves() {
  this.leaveService.myLeaves().subscribe({
    next: (res: any) => {
      this.leaves = res;
      this.filteredLeaves = res;  // Initialize filteredLeaves
    },
    error: () => this.showToast('Failed to fetch leaves')
  });
}
filterLeaves() {
  const filter = this.leaveFilter.toLowerCase().trim();
  if (!filter) {
    this.filteredLeaves = this.leaves;
  } else {
    this.filteredLeaves = this.leaves.filter(l =>
      l.reason.toLowerCase().includes(filter) ||
      (l.status && l.status.toLowerCase().includes(filter)) ||
      (l.remarks && l.remarks.toLowerCase().includes(filter)) ||
      (l.start_date && l.start_date.includes(filter)) ||  // Date filter text match
      (l.end_date && l.end_date.includes(filter))
    );
  }
}
  loadBalance() {
    this.leaveService.getLeaveBalance().subscribe({
      next: (res) => this.balance = res,
      error: () => this.showToast('Failed to fetch leave balance')
    });
  }

  setView(view: 'dashboard' | 'apply' | 'myLeaves' | 'approvals' | 'balances') {
    this.currentView = view;
    if (view === 'balances') this.loadBalance();
    if (view === 'myLeaves' || view === 'approvals') this.loadLeaves();
  }

  applyLeave() {
  if (!this.newLeave.start_date || !this.newLeave.end_date || !this.newLeave.reason) {
    this.showToast('All fields are required');
    return;
  }

  const start = new Date(this.newLeave.start_date);
  const end = new Date(this.newLeave.end_date);

  if (start > end) {
    this.showToast('Start Date cannot be after End Date');
    return;
  }

  const category = this.getLeaveType(this.newLeave.reason);
  
  // Check leave balance before applying
  let availableBalance = 0;
  if (category === 'sick') {
    availableBalance = this.balance.sick;
  } else if (category === 'medical') {
    availableBalance = this.balance.medical;
  } else if (category === 'privileged') {
    availableBalance = this.balance.privileged;
  }
  
  if (this.numberOfDays > availableBalance) {
    this.showToast(`Insufficient ${category} leave balance. You have only ${availableBalance} day(s) left.`);
    return;
  }

  const leavePayload = { 
    ...this.newLeave,
    leave_type: category,
    employee_id: localStorage.getItem('emp_id')
  };

  this.leaveService.applyLeave(leavePayload).subscribe({
    next: () => {
      this.showToast(' Leave applied successfully');
      this.newLeave = { start_date: '', end_date: '', reason: '', leave_type: 'sick' };
      this.loadLeaves();
      this.numberOfDays = 0;
      setTimeout(() => this.setView('myLeaves'), 3000);
    },
    error: (err: any) => {
      const msg = (err?.error?.error) || 'Failed to apply leave';
      this.showToast(msg);
    }
  });
}

  deleteLeave(id: number) {
    this.leaveService.deleteLeave(id).subscribe({
      next: () => {
        this.showToast(`🗑️ Leave #${id} cancelled`);
        this.loadLeaves();
      },
      error: () => this.showToast('Failed to delete leave')
    });
  }

  confirmLogout() {
    this.auth.logout();
  }

  showToast(message: string) {
    this.toastMessage = message;
    setTimeout(() => { this.toastMessage = ''; }, 3000);
  }
}
