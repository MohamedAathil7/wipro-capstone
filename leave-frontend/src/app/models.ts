
export interface LoginResponse {
  id?: string | number;
  role: string;
  username?: string;
  message?: string;
}


export interface LeaveRequest {
  id: number;
  employee_name: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  remarks?: string;
  leave_type?: string;
  start_date?: string;
  end_date?: string;
  applied_date?: string;
}


export interface UpdateLeaveStatusRequest {
  leave_id: number;
  status: string;
  remarks: string;
}