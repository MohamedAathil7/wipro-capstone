from extension import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(10), default="manager")
    approved = db.Column(db.Boolean, default=True)

class LeaveRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    reason = db.Column(db.String(200), nullable=False)
    leave_type = db.Column(db.String(20), nullable=False)  # ← ADD THIS (sick|medical|privileged)
    start_date = db.Column(db.String(20), nullable=False)
    end_date   = db.Column(db.String(20), nullable=False)
    status  = db.Column(db.String(20), default="Pending")
    remarks = db.Column(db.String(200), nullable=True)
    employee = db.relationship('User', backref='leave_requests')

class LeaveBalance(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    sick = db.Column(db.Integer, default=10)
    medical     = db.Column(db.Integer, default=10)
    privileged  = db.Column(db.Integer, default=17)

    employee = db.relationship('User', backref=db.backref('leave_balance', uselist=False))
