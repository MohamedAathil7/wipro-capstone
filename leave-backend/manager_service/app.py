import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from extension import db
from models import User, LeaveRequest, LeaveBalance  # ← include LeaveBalance

app = Flask(__name__)
CORS(app, supports_credentials=True)

# ✅ Use absolute path so Docker volume works
DB_PATH = os.path.join("/app", "instance", "manager.db")
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{DB_PATH}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

@app.route("/create_employee", methods=["POST"])
def create_employee():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 409

    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password=hashed_password, role="employee", approved=False)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": f"Employee {username} created successfully."}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    user = User.query.filter_by(username=data["username"]).first()
    if not user or not check_password_hash(user.password, data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401
    return jsonify({"message": f"Welcome {user.username}", "role": user.role, "id": user.id})

@app.route("/pending_employees", methods=["GET"])
def pending_employees():
    users = User.query.filter_by(role="employee", approved=False).all()
    return jsonify([{"id": u.id, "username": u.username} for u in users])

@app.route("/approve_employee/<int:user_id>", methods=["PUT"])
def approve_employee(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.approved = True
    if not LeaveBalance.query.filter_by(employee_id=user.id).first():
        db.session.add(LeaveBalance(employee_id=user.id))
    db.session.commit()
    return jsonify({"message": f"Employee {user.username} approved and leave balance initialized"})

@app.route("/leave_requests", methods=["GET"])
def leave_requests():
    requests_ = LeaveRequest.query.filter_by(status="Pending").all()
    return jsonify([
        {
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": r.employee.username,
            "reason": r.reason,
            "status": r.status,
            "remarks": r.remarks or "",
            "start_date": r.start_date,
            "end_date": r.end_date
        } for r in requests_
    ])

@app.route("/all_leaves", methods=["GET"])
def all_leaves():
    requests_ = LeaveRequest.query.all()
    return jsonify([
        {
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": r.employee.username,
            "reason": r.reason,
            "status": r.status,
            "remarks": r.remarks or "",
            "start_date": r.start_date,
            "end_date": r.end_date
        } for r in requests_
    ])

@app.route("/update_leave/<int:leave_id>", methods=["PUT"])
def update_leave(leave_id):
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        leave = LeaveRequest.query.get(leave_id)
        if not leave:
            return jsonify({"error": "Leave not found"}), 404

        status = data.get("status")
        remarks = data.get("remarks", "")

        if status not in ["Approved", "Rejected", "Pending"]:
            return jsonify({"error": "Invalid status"}), 400

        if status == "Approved":
            balance = LeaveBalance.query.filter_by(employee_id=leave.employee_id).first()
            if not balance:
                return jsonify({"error": "Leave balance not found"}), 404

            days_requested = (
                datetime.strptime(leave.end_date, "%Y-%m-%d") -
                datetime.strptime(leave.start_date, "%Y-%m-%d")
            ).days + 1

            lt = (leave.leave_type or "").lower()
            if lt == "sick":
                if balance.sick < days_requested:
                    return jsonify({"error": "Insufficient Sick/Casual balance"}), 400
                balance.sick -= days_requested
            elif lt == "medical":
                if balance.medical < days_requested:
                    return jsonify({"error": "Insufficient Medical balance"}), 400
                balance.medical -= days_requested
            elif lt == "privileged":
                if balance.privileged < days_requested:
                    return jsonify({"error": "Insufficient Privileged balance"}), 400
                balance.privileged -= days_requested
            else:
                return jsonify({"error": "Invalid leave type"}), 400

        leave.status = status
        leave.remarks = remarks
        db.session.commit()
        return jsonify({"message": f"Leave {status.lower()} successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/health")
def health():
    return jsonify({"status": "manager-ok"})

# ---- Init DB ----
with app.app_context():
    os.makedirs("/app/instance", exist_ok=True)
    db.create_all()
    if not User.query.filter_by(username="aathil").first():
        hashed_password = generate_password_hash("123")
        db.session.add(User(username="aathil", password=hashed_password, role="manager", approved=True))
        db.session.commit()
if __name__ == "__main__":
    # bind on all interfaces so Docker can publish the port
    app.run(host="0.0.0.0", port=5002, debug=False)
