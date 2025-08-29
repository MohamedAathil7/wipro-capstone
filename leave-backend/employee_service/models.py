from extension import db
from werkzeug.security import generate_password_hash

class User(db.Model):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(10), default="employee")  # "employee" or "manager"
    approved = db.Column(db.Boolean, default=False)

    @staticmethod
    def make(username: str, pwd: str, role: str = "employee", approved: bool = True):
        return User(
            username=username,
            password=generate_password_hash(pwd),
            role=role,
            approved=approved
        )

class LeaveRequest(db.Model):
    __tablename__ = "leave_request"
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    reason = db.Column(db.String(200), nullable=False)
    leave_type = db.Column(db.String(20), nullable=False)  # sick | medical | privileged
    start_date = db.Column(db.String(20), nullable=False)   # "YYYY-MM-DD"
    end_date = db.Column(db.String(20), nullable=False)     # "YYYY-MM-DD"
    status = db.Column(db.String(20), default="Pending")    # Pending | Approved | Rejected
    remarks = db.Column(db.String(200), nullable=True)

    employee = db.relationship("User", backref="leave_requests")

class LeaveBalance(db.Model):
    __tablename__ = "leave_balance"
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    sick = db.Column(db.Integer, default=10)
    medical = db.Column(db.Integer, default=20)
    privileged = db.Column(db.Integer, default=18)

    employee = db.relationship("User", backref=db.backref("leave_balance", uselist=False))
