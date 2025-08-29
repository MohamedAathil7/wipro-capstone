import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from extension import db
from models import User, LeaveRequest, LeaveBalance

app = Flask(__name__)
CORS(app, supports_credentials=True)  # same-origin via Nginx, but safe to leave on

# ✅ FIX: use absolute path for DB so Docker can access it
INSTANCE_DIR = "/app/instance"
os.makedirs(INSTANCE_DIR, exist_ok=True)
DB_PATH = os.path.join(INSTANCE_DIR, "lms.db")

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

def parse_date(date_str: str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return datetime.strptime(date_str, "%d-%m-%Y").date()

def ensure_balance_for(employee_id: int) -> LeaveBalance:
    bal = LeaveBalance.query.filter_by(employee_id=employee_id).first()
    if not bal:
        bal = LeaveBalance(employee_id=employee_id, sick=10, medical=10, privileged=17)
        db.session.add(bal)
        db.session.commit()
    return bal

# ------------- Auth -----------------------
@app.route("/login", methods=["POST"])
def login():
    data = (request.get_json(silent=True) or {})
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"error": "Invalid credentials"}), 401

    if user.role == "employee" and not user.approved:
        return jsonify({"error": "Your account is not yet approved by manager"}), 403

    return jsonify({"message": f"Welcome {user.username}", "role": user.role, "id": user.id, "username": user.username}), 200

# ------------- Manager: Employees ----------
@app.route("/create_employee", methods=["POST"])
def create_employee():
    data = (request.get_json(silent=True) or {})
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 409

    hashed = generate_password_hash(password)
    emp = User(username=username, password=hashed, role="employee", approved=False)
    db.session.add(emp)
    db.session.commit()
    return jsonify({"message": f"Employee {username} created successfully."}), 201

@app.route("/pending_employees", methods=["GET"])
def pending_employees():
    users = User.query.filter_by(role="employee", approved=False).all()
    return jsonify([{"id": u.id, "username": u.username} for u in users]), 200

@app.route("/approve_employee/<int:user_id>", methods=["PUT"])
def approve_employee(user_id: int):
    user = User.query.get(user_id)
    if not user or user.role != "employee":
        return jsonify({"error": "User not found"}), 404
    user.approved = True
    ensure_balance_for(user.id)
    db.session.commit()
    return jsonify({"message": f"Employee {user.username} approved"}), 200

@app.route("/employees", methods=["GET"])
def employees():
    emps = User.query.filter_by(role="employee").all()
    out = []
    for e in emps:
        total_leaves = LeaveRequest.query.filter_by(employee_id=e.id).count()
        pending = LeaveRequest.query.filter_by(employee_id=e.id, status="Pending").count()
        out.append({
            "id": e.id,
            "username": e.username,
            "approved": e.approved,
            "total_leaves": total_leaves,
            "pending_leaves": pending
        })
    return jsonify(out), 200

# ------------- Employee: Leaves ------------
@app.route("/apply_leave", methods=["POST"])
def apply_leave():
    data = (request.get_json(silent=True) or {})
    employee_id = data.get("employee_id")
    reason = (data.get("reason") or "").strip()
    leave_type = (data.get("leave_type") or "").strip().lower()  # sick|medical|privileged
    start_date = data.get("start_date")
    end_date = data.get("end_date")

    if not employee_id or not reason or not leave_type or not start_date or not end_date:
        return jsonify({"error": "employee_id, reason, leave_type, start_date, end_date are required"}), 400

    if leave_type not in {"sick", "medical", "privileged"}:
        return jsonify({"error": "Invalid leave_type. Use sick|medical|privileged"}), 400

    emp = User.query.get(employee_id)
    if not emp or emp.role != "employee":
        return jsonify({"error": "Employee not found"}), 404
    if not emp.approved:
        return jsonify({"error": "Employee is not approved yet"}), 403

    try:
        sd = parse_date(start_date)
        ed = parse_date(end_date)
    except Exception:
        return jsonify({"error": "Invalid date format (use YYYY-MM-DD)"}), 400
    if (ed - sd).days < 0:
        return jsonify({"error": "end_date must be on/after start_date"}), 400

    leave = LeaveRequest(
        employee_id=emp.id,
        reason=reason,
        leave_type=leave_type,
        start_date=sd.strftime("%Y-%m-%d"),
        end_date=ed.strftime("%Y-%m-%d"),
        status="Pending",
        remarks=data.get("remarks") or ""
    )
    db.session.add(leave)
    db.session.commit()
    return jsonify({"message": "Leave applied successfully"}), 201

@app.route("/my_leaves/<int:employee_id>", methods=["GET"])
def my_leaves(employee_id: int):
    leaves = LeaveRequest.query.filter_by(employee_id=employee_id).all()
    return jsonify([{
        "id": l.id,
        "reason": l.reason,
        "leave_type": l.leave_type,
        "status": l.status,
        "remarks": l.remarks or "",
        "start_date": l.start_date,
        "end_date": l.end_date
    } for l in leaves]), 200

@app.route("/delete_leave/<int:leave_id>", methods=["DELETE"])
def delete_leave(leave_id: int):
    l = LeaveRequest.query.get(leave_id)
    if not l:
        return jsonify({"error": "Leave request not found"}), 404
    if l.status != "Pending":
        return jsonify({"error": f"Cannot delete leave with status '{l.status}'"}), 400
    db.session.delete(l)
    db.session.commit()
    return jsonify({"message": "Leave request successfully deleted"}), 200

# ------------- Manager: Leaves -------------
@app.route("/all_leaves", methods=["GET"])
def all_leaves():
    rows = db.session.query(LeaveRequest, User).join(User, LeaveRequest.employee_id == User.id).all()
    result = [{
        "id": leave.id,
        "employee_id": user.id,
        "employee_name": user.username,
        "reason": leave.reason,
        "leave_type": leave.leave_type,
        "status": leave.status,
        "remarks": leave.remarks or "",
        "start_date": leave.start_date,
        "end_date": leave.end_date
    } for leave, user in rows]
    return jsonify(result), 200

@app.route("/update_leave/<int:leave_id>", methods=["PUT"])
def update_leave(leave_id: int):
    data = (request.get_json(silent=True) or {})
    status = data.get("status")
    remarks = (data.get("remarks") or "").strip()

    if status not in {"Approved", "Rejected", "Pending"}:
        return jsonify({"error": "Invalid status"}), 400

    leave = LeaveRequest.query.get(leave_id)
    if not leave:
        return jsonify({"error": "Leave not found"}), 404

    if status == "Approved":
        bal = ensure_balance_for(leave.employee_id)
        start = parse_date(leave.start_date)
        end = parse_date(leave.end_date)
        days = (end - start).days + 1

        if leave.leave_type == "sick":
            if bal.sick < days:
                return jsonify({"error": "Insufficient Sick/Casual balance"}), 400
            bal.sick -= days
        elif leave.leave_type == "medical":
            if bal.medical < days:
                return jsonify({"error": "Insufficient Medical balance"}), 400
            bal.medical -= days
        elif leave.leave_type == "privileged":
            if bal.privileged < days:
                return jsonify({"error": "Insufficient Privileged balance"}), 400
            bal.privileged -= days
        else:
            return jsonify({"error": "Invalid leave type on record"}), 400

        db.session.add(bal)

    leave.status = status
    leave.remarks = remarks
    db.session.commit()
    return jsonify({"message": f"Leave {status.lower()} successfully"}), 200

# ------------- Balances / Stats ------------
@app.route("/leave_balance/<int:employee_id>", methods=["GET"])
def leave_balance(employee_id: int):
    bal = LeaveBalance.query.filter_by(employee_id=employee_id).first()
    if not bal:
        return jsonify({"error": "Leave balance not found"}), 404
    return jsonify({
        "sick": bal.sick,
        "medical": bal.medical,
        "privileged": bal.privileged
    }), 200

@app.route("/employee_balances", methods=["GET"])
def employee_balances():
    rows = db.session.query(User, LeaveBalance)\
        .join(LeaveBalance, LeaveBalance.employee_id == User.id)\
        .filter(User.role == "employee").all()
    return jsonify([{
        "username": user.username,
        "sick": bal.sick,
        "medical": bal.medical,
        "privileged": bal.privileged
    } for user, bal in rows]), 200

@app.route("/leave_statistics", methods=["GET"])
def leave_statistics():
    total = LeaveRequest.query.count()
    pending = LeaveRequest.query.filter_by(status="Pending").count()
    approved = LeaveRequest.query.filter_by(status="Approved").count()
    rejected = LeaveRequest.query.filter_by(status="Rejected").count()
    return jsonify({"total": total, "pending": pending, "approved": approved, "rejected": rejected}), 200

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "employee-ok"}), 200

# ---- Init DB ----
with app.app_context():
    db.create_all()
    if not User.query.filter_by(username="aathil", role="manager").first():
        m = User.make("aathil", "123", role="manager", approved=True)
        db.session.add(m)
        db.session.commit()
        print("✅ Seeded manager: manager / manager123")

# ✅ Run when not inside gunicorn
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
