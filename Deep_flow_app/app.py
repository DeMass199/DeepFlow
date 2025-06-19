from flask import Flask, request, render_template, redirect, url_for, flash, session
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
import logging
import json
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder="templates")  # Explicitly set the templates folder
app.secret_key = os.environ.get('SECRET_KEY', 'default_secret_key')

# Ensure DB_PATH points to Deepflow.db
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Deepflow.db')

def validate_password(password):
    """
    Validates if the password meets the security requirements.
    Returns a tuple (is_valid, message) where:
    - is_valid: Boolean indicating if password is valid
    - message: Reason why password is invalid, or None if valid
    """
    missing_requirements = []
    
    # Check length
    if len(password) < 10:
        missing_requirements.append("at least 10 characters")
    
    # Check for uppercase
    has_uppercase = any(char.isupper() for char in password)
    if not has_uppercase:
        missing_requirements.append("an uppercase letter")
    
    # Check for numbers
    has_number = any(char.isdigit() for char in password)
    if not has_number:
        missing_requirements.append("a number")
    
    # Check for symbols (non-alphanumeric characters)
    has_symbol = any(not char.isalnum() for char in password)
    if not has_symbol:
        missing_requirements.append("a symbol")
    
    # Remove the common words check to simplify password requirements
    # We'll still keep the basic security requirements (length, uppercase, number, symbol)
    
    # If there are missing requirements, return the formatted message
    if missing_requirements:
        if len(missing_requirements) == 1:
            message = f"Please add {missing_requirements[0]} to your password."
        else:
            requirements_text = ", ".join(missing_requirements[:-1]) + f" and {missing_requirements[-1]}"
            message = f"Please add {requirements_text} to your password."
        return False, message
    
    # If all checks pass
    return True, None

def add_user_to_db(username, password):
    """Adds a new user to the database.
    Returns a tuple (status_code, message)
    status_code: 'success', 'exists', 'db_error', 'file_error', 'unexpected_error'
    message: descriptive message for logging/flashing
    """
    conn = None
    try:
        logger.debug("Attempting to add user '%s' to database at %s", username, DB_PATH)

        # First check if the database file exists
        if not os.path.exists(DB_PATH):
            logger.error("Database file does not exist at %s", DB_PATH)
            return "file_error", "Database file not found."

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if username exists
        cursor.execute("SELECT username FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            logger.warning("Username '%s' already exists in database", username)
            return "exists", f"Username '{username}' already exists."

        # Hash password and insert user
        hashed_password = generate_password_hash(password)
        logger.debug("Password hashed successfully")

        cursor.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (username, hashed_password)
        )
        conn.commit()
        logger.info("User '%s' added to database successfully", username)
        return "success", f"User '{username}' added successfully."
    except sqlite3.Error as e:
        logger.error("SQLite error: %s when adding user '%s'", str(e), username)
        if conn:
            conn.rollback()
        return "db_error", f"Database error: {str(e)}"
    except (ValueError, TypeError) as e:  # Catch specific exceptions instead of generic Exception
        logger.error("Input error: %s when adding user '%s'", str(e), username)
        if conn:
            conn.rollback()
        return "input_error", f"Input validation error: {str(e)}"
    finally:
        if conn:
            conn.close()

# Update the database schema
def init_db():
    """Initialize the database with proper schema"""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Create the users table in Deepflow.db
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        """)
        
        # Create the timers table in Deepflow.db
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS timers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                duration INTEGER NOT NULL, -- Duration in seconds
                start_time TEXT DEFAULT NULL,
                end_time TEXT DEFAULT NULL,
                paused_at TEXT DEFAULT NULL,
                is_running INTEGER NOT NULL DEFAULT 0, -- 0: stopped, 1: running, 2: paused
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Create flow_shelf table for task queue
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS flow_shelf (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                task_text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed BOOLEAN NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Create energy_logs table for energy tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS energy_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                timer_id INTEGER NOT NULL,
                stage TEXT NOT NULL,  -- 'start' or 'end'
                energy_level INTEGER NOT NULL,  -- 1-10
                timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (timer_id) REFERENCES timers (id)
            )
        """)
        
        # Create energy_insights table for detailed energy insights
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS energy_insights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                overall_energy INTEGER NOT NULL,  -- 1-10
                motivation_level INTEGER NOT NULL,  -- 1-10
                focus_clarity INTEGER NOT NULL,  -- 1-10
                physical_energy INTEGER NOT NULL,  -- 1-10
                mood_state TEXT NOT NULL,  -- happy, calm, stressed, anxious, excited, etc.
                energy_source TEXT,  -- what's contributing to current energy
                energy_drains TEXT,  -- what's draining energy
                notes TEXT,  -- additional user notes
                timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        conn.commit()
        logger.info("Database initialized successfully")
        return True
    except sqlite3.Error as e:
        logger.error("Database initialization error: %s", str(e))
        return False
    finally:
        if conn:
            conn.close()

# Initialize the database
init_db()

def validate_user(username, password):
    """Validates a user's credentials"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        conn.close()
        
        if user and check_password_hash(user[2], password):
            return user
        return None
    except sqlite3.Error as e:
        logger.error("Database error: %s", str(e))
        return None

@app.route("/")
def home():
    """Home page with statistics"""
    stats = {
        'total_users': 0,
        'total_timers': 0,
        'total_tasks': 0
    }
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        stats['total_users'] = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM timers")
        stats['total_timers'] = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM flow_shelf")
        stats['total_tasks'] = cursor.fetchone()[0]
        conn.close()
    except sqlite3.Error as e:
        logger.error("Error fetching stats: %s", str(e))
    
    return render_template("index.html", stats=stats)


@app.route("/login", methods=["GET", "POST"])
def login():
    """Handles user login"""
    if request.method == "POST":
        username = request.form.get("username").strip()
        password = request.form.get("password").strip()
        if not username or not password:
            flash("Please provide both username and password", "error")
            return redirect(url_for("login"))

        user = validate_user(username, password)
        if user:
            session['user_id'] = user[0]  # Set user ID in session
            session['username'] = user[1]  # Set username in session
            flash("Login successful!", "success")
            return redirect(url_for("dashboard"))  # Redirect to dashboard
        else:
            flash("Invalid username or password!", "error")

    return render_template("login.html")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    """Handles user signup"""
    if request.method == "POST":
        username = request.form.get("username").strip()
        password = request.form.get("password").strip()
        confirm_password = request.form.get("confirm_password").strip()

        # Added detailed logging for debugging
        logger.debug("Signup attempt with username: %s", username)
        logger.debug("Form data received: username=%s, password length=%d, confirm_password length=%d", 
                    username, len(password), len(confirm_password))

        if not username or not password or not confirm_password:
            logger.warning("Signup failed: Missing required fields")
            flash("All fields are required!", "error")
            return redirect(url_for("signup"))

        if password != confirm_password:
            logger.warning("Signup failed: Passwords don't match")
            flash("Passwords do not match!", "error")
            return redirect(url_for("signup"))
        
        # Validate password using our password checker
        is_valid, message = validate_password(password)
        if not is_valid:
            logger.warning("Signup failed: Invalid password - %s", message)
            flash(message, "error")
            return redirect(url_for("signup"))

        # Try to add the user to the database
        status, db_message = add_user_to_db(username, password)
        logger.debug("Add user to database result: status=%s, message='%s'", status, db_message)

        # Debug - check database state
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            logger.debug("Current user count in database: %d", user_count)
            
            cursor.execute("SELECT username FROM users")
            usernames = [row[0] for row in cursor.fetchall()]
            logger.debug("Current usernames in database: %s", usernames)
            conn.close()
        except sqlite3.Error as e:
            logger.error("Debug query error: %s", str(e))
        
        if status == "success":
            logger.info("New user created: %s", username)
            flash("Account created successfully! Please log in.", "success")
            return redirect(url_for("login"))
        else:
            logger.error("Failed to create user '%s': %s", username, db_message)
            if status == "exists":
                flash("Username already exists. Please choose a different one.", "error")
            elif status == "file_error":
                flash("System configuration error. Please contact an administrator.", "error")
            elif status == "db_error" or status == "unexpected_error":
                flash("An error occurred while creating your account. Please try again.", "error")
            else: # Should not happen if all cases in add_user_to_db are handled
                flash("An unknown error occurred during signup. Please try again.", "error")
            return redirect(url_for("signup"))

    # Clear any leftover flash messages when rendering the signup page
    session.pop('_flashes', None)
    return render_template("signup.html")


@app.route("/dashboard", methods=["GET", "POST"])
def dashboard():
    """Dashboard to manage timers"""
    if 'user_id' not in session:  # Check if user is logged in
        flash("Please login first!", "error")
        return redirect(url_for("login"))
    
    user_id = session['user_id']
    timers = []
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Fetch timers without resetting paused ones
        cursor.execute("SELECT * FROM timers WHERE user_id = ?", (user_id,))
        timers = cursor.fetchall()
        conn.close()
    except sqlite3.Error as e:
        logger.error("Error fetching timers: %s", str(e))
        flash("Failed to load timers.", "error")
    
    return render_template("dashboard.html", timers=timers)  # Render dashboard.html


@app.route("/add_timer", methods=["POST"])
def add_timer():
    """Add a new timer"""
    if 'user_id' not in session:
        flash("Please login first!", "error")
        return redirect(url_for("login"))
    
    user_id = session['user_id']
    name = request.form.get("name")
    duration = request.form.get("duration")
    
    if not name or not duration:
        flash("Name and duration are required!", "error")
        return redirect(url_for("dashboard"))
    
    try:
        # Validate duration: only allow 30-240 minutes in 5-minute intervals
        duration_int = int(duration)
        if duration_int < 30 or duration_int > 240 or duration_int % 5 != 0:
            logger.warning("Invalid duration value: %d. Setting to default (90 minutes).", duration_int)
            duration_int = 90  # Set to default 90 minutes if invalid
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Convert minutes to seconds for storage
        duration_seconds = duration_int * 60
        cursor.execute("""
            INSERT INTO timers (user_id, name, duration)
            VALUES (?, ?, ?)
        """, (user_id, name, duration_seconds))
        conn.commit()
        conn.close()
        flash("Timer added successfully!", "success")
    except (ValueError, TypeError) as e:
        logger.error("Error with duration value: %s", str(e))
        flash("Invalid duration format. Please try again.", "error")
        return redirect(url_for("dashboard"))
    except sqlite3.Error as e:
        logger.error("Error adding timer: %s", str(e))
        flash("Failed to add timer.", "error")
    
    return redirect(url_for("dashboard"))


@app.route("/update_timer/<int:timer_id>", methods=["POST"])
def update_timer(timer_id):
    """Start or stop a timer - supports both form submission and JSON API"""
    if 'user_id' not in session:
        if request.is_json:
            return {"error": "Not authenticated"}, 401
        flash("Please login first!", "error")
        return redirect(url_for("login"))
    
    # Handle JSON requests for API
    if request.is_json:
        data = request.get_json()
        action = data.get("action")
    else:
        action = request.form.get("action")  # 'start', 'pause', or 'stop'
    
    # Log what we received
    logger.debug("Received timer update request: timer_id=%d, action=%s, request_type=%s", timer_id, action, 'JSON' if request.is_json else 'form')
    
    # Validate action
    if action not in ["start", "pause", "resume", "stop"]:
        logger.warning("Invalid timer action requested: %s", action)
        if request.is_json:
            return {"error": "Invalid action", "success": False}, 400
        flash("Invalid timer action.", "error")
        return redirect(url_for("dashboard"))
    
    logger.info("Updating timer %d with action: %s for user %d", timer_id, action, session['user_id'])
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # First check if the timer exists and belongs to the user
        cursor.execute("""
            SELECT id FROM timers 
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        
        if not cursor.fetchone():
            logger.warning("Timer %d not found or doesn't belong to user %d", timer_id, session['user_id'])
            if request.is_json:
                return {"error": "Timer not found", "success": False}, 404
            flash("Timer not found.", "error")
            return redirect(url_for("dashboard"))
        
        if action == "start":
            cursor.execute("""
                UPDATE timers
                SET is_running = 1, start_time = datetime('now', 'localtime'), end_time = NULL
                WHERE id = ? AND user_id = ?
            """, (timer_id, session['user_id']))
            logger.debug("Started timer %d", timer_id)
        elif action == "pause":
            # For pause, we store a special state by adding a pause_timestamp
            # We'll keep is_running = 1 but add a 'paused_at' timestamp
            cursor.execute("""
                UPDATE timers
                SET is_running = 2, paused_at = datetime('now', 'localtime')
                WHERE id = ? AND user_id = ?
            """, (timer_id, session['user_id']))
            logger.debug("Paused timer %d", timer_id)
        elif action == "resume":
            # Resume is similar to start, but we keep the original start_time
            cursor.execute("""
                UPDATE timers
                SET is_running = 1, paused_at = NULL
                WHERE id = ? AND user_id = ?
            """, (timer_id, session['user_id']))
            logger.debug("Resumed timer %d", timer_id)
        elif action == "stop":
            cursor.execute("""
                UPDATE timers
                SET is_running = 0, end_time = datetime('now', 'localtime')
                WHERE id = ? AND user_id = ?
            """, (timer_id, session['user_id']))
            logger.debug("Stopped timer %d", timer_id)
        
        conn.commit()
        
        # Check if the update was successful
        cursor.execute("""
            SELECT is_running FROM timers
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        
        row = cursor.fetchone()
        is_running = row[0] if row else None
        
        # Make sure the database update worked as expected
        expected_running = 1 if action in ["start", "resume"] else 2 if action == "pause" else 0 if action == "stop" else None
        if expected_running is not None and is_running != expected_running:
            logger.error("Timer update failed: expected is_running=%d, got %d", expected_running, is_running)
            conn.close()
            if request.is_json:
                return {"error": "Timer update failed", "success": False}, 500
            flash("Failed to update timer status.", "error")
            return redirect(url_for("dashboard"))
        
        conn.close()
        
        if request.is_json:
            return {"success": True, "message": f"Timer {action}ed successfully", "status": action, "timer_id": timer_id}, 200
        
        flash(f"Timer {action}ed successfully!", "success")
        return redirect(url_for("dashboard"))
    except sqlite3.Error as e:
        logger.error("Database error updating timer: %s", str(e))
        
        if request.is_json:
            return {"error": f"Database error: {str(e)}", "success": False}, 500
        
        flash(f"Failed to update timer: {str(e)}", "error")
        return redirect(url_for("dashboard"))


@app.route("/delete_timer/<int:timer_id>", methods=["POST"])
def delete_timer(timer_id):
    """Delete a timer"""
    if 'user_id' not in session:
        flash("Please login first!", "error")
        return redirect(url_for("login"))
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM timers WHERE id = ? AND user_id = ?", (timer_id, session['user_id']))
        conn.commit()
        conn.close()
        flash("Timer deleted successfully!", "success")
    except sqlite3.Error as e:
        logger.error("Error deleting timer: %s", str(e))
        flash("Failed to delete timer.", "error")
    
    return redirect(url_for("dashboard"))


@app.route("/logout")
def logout():
    """Handle user logout"""
    session.clear()  # Clear all session data
    flash("You have been logged out successfully.", "success")
    return redirect(url_for("login"))


# New API endpoints for advanced DeepFlow features

# Flow Shelf API Endpoints

@app.route("/add_shelf_item", methods=["POST"])
def add_shelf_item():
    """Add an item to the Flow Shelf"""
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    if request.is_json:
        data = request.get_json()
        text = data.get("text")
        
        if not text:
            return {"error": "Text is required"}, 400
        
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO flow_shelf (user_id, task_text)
                VALUES (?, ?)
            """, (session['user_id'], text))
            
            # Get the ID of the newly inserted item
            item_id = cursor.lastrowid
            
            conn.commit()
            conn.close()
            
            return {
                "success": True,
                "id": item_id,
                "text": text,
                "message": "Item added to Flow Shelf"
            }, 200
        except sqlite3.Error as e:
            logger.error("Error adding shelf item: %s", str(e))
            return {"error": "Database error"}, 500
    
    return {"error": "Invalid request"}, 400


@app.route("/remove_shelf_item", methods=["POST"])
def remove_shelf_item():
    """Remove an item from the Flow Shelf"""
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    if request.is_json:
        data = request.get_json()
        item_id = data.get("id")
        text = data.get("text")
        
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # If we have the ID, use that; otherwise use the text
            if item_id:
                cursor.execute("""
                    DELETE FROM flow_shelf
                    WHERE id = ? AND user_id = ?
                """, (item_id, session['user_id']))
            elif text:
                cursor.execute("""
                    DELETE FROM flow_shelf
                    WHERE task_text = ? AND user_id = ?
                """, (text, session['user_id']))
            else:
                return {"error": "ID or text is required"}, 400
            
            conn.commit()
            conn.close()
            
            return {
                "success": True,
                "message": "Item removed from Flow Shelf"
            }, 200
        except sqlite3.Error as e:
            logger.error("Error removing shelf item: %s", str(e))
            return {"error": "Database error"}, 500
    
    return {"error": "Invalid request"}, 400


@app.route("/get_shelf_items", methods=["GET"])
def get_shelf_items():
    """Get all items from the Flow Shelf"""
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, task_text, created_at, completed
            FROM flow_shelf
            WHERE user_id = ?
            ORDER BY created_at DESC
        """, (session['user_id'],))
        
        items = []
        for row in cursor.fetchall():
            items.append({
                "id": row[0],
                "text": row[1],
                "created_at": row[2],
                "completed": bool(row[3])
            })
        
        conn.close()
        
        return {"items": items}, 200
    except sqlite3.Error as e:
        logger.error("Error getting shelf items: %s", str(e))
        return {"error": "Database error"}, 500


# Energy Log API Endpoints

@app.route("/log_energy", methods=["POST"])
def log_energy():
    """Log user's energy level for a timer session"""
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    if request.is_json:
        data = request.get_json()
        timer_id = data.get("timer_id")
        stage = data.get("stage")  # 'start' or 'end'
        energy_level = data.get("energy_level")  # 1-10
        focus_level = data.get("focus_level")  # 1-10 (optional)
        
        if not all([timer_id, stage, energy_level]):
            return {"error": "Timer ID, stage, and energy level are required"}, 400
        
        if stage not in ['start', 'end']:
            return {"error": "Stage must be 'start' or 'end'"}, 400
        
        try:
            energy_level = int(energy_level)
            if not (1 <= energy_level <= 10):
                return {"error": "Energy level must be between 1 and 10"}, 400
                
            # Validate focus level if provided
            if focus_level is not None:
                focus_level = int(focus_level)
                if not (1 <= focus_level <= 10):
                    return {"error": "Focus level must be between 1 and 10"}, 400
        except (ValueError, TypeError):
            return {"error": "Energy and focus levels must be numbers"}, 400
        
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Check if the timer belongs to the user
            cursor.execute("""
                SELECT id FROM timers
                WHERE id = ? AND user_id = ?
            """, (timer_id, session['user_id']))
            
            if not cursor.fetchone():
                conn.close()
                return {"error": "Timer not found or doesn't belong to user"}, 404
            
            # Insert energy log
            cursor.execute("""
                INSERT INTO energy_logs (user_id, timer_id, stage, energy_level)
                VALUES (?, ?, ?, ?)
            """, (session['user_id'], timer_id, stage, energy_level))

            # If the stage is 'start', also start the timer
            if stage == 'start':
                cursor.execute("""
                    UPDATE timers
                    SET is_running = 1, start_time = datetime('now', 'localtime'), end_time = NULL, paused_at = NULL
                    WHERE id = ? AND user_id = ?
                """, (timer_id, session['user_id']))
                logger.debug(f"Timer {timer_id} started automatically after energy log.")
            elif stage == 'end':
                cursor.execute("""
                    UPDATE timers
                    SET is_running = 0, end_time = datetime('now', 'localtime')
                    WHERE id = ? AND user_id = ?
                """, (timer_id, session['user_id']))
                logger.debug(f"Timer {timer_id} stopped automatically after energy log.")
            
            conn.commit()
            conn.close()
            
            return {
                "success": True,
                "message": "Energy logged and timer action completed successfully"
            }, 200
        except sqlite3.Error as e:
            logger.error("Error logging energy: %s", str(e))
            return {"error": "Database error"}, 500
    
    return {"error": "Invalid request"}, 400


@app.route("/get_energy_logs", methods=["GET"])
def get_energy_logs():
    """Get energy logs for the user"""
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # This enables column access by name
        cursor = conn.cursor()
        
        # Join with timers to get timer names
        cursor.execute("""
            SELECT e.id, e.timer_id, t.name as timer_name, e.stage, 
                   e.energy_level, e.timestamp
            FROM energy_logs e
            JOIN timers t ON e.timer_id = t.id
            WHERE e.user_id = ?
            ORDER BY e.timestamp DESC
        """, (session['user_id'],))
        
        logs = []
        for row in cursor:
            logs.append({
                "id": row["id"],
                "timer_id": row["timer_id"],
                "timer_name": row["timer_name"],
                "stage": row["stage"],
                "energy_level": row["energy_level"],
                "timestamp": row["timestamp"]
            })
        
        conn.close()
        
        return {"logs": logs}, 200
    except sqlite3.Error as e:
        logger.error("Error getting energy logs: %s", str(e))
        return {"error": "Database error"}, 500


# New timer control routes
@app.route("/start_timer/<int:timer_id>", methods=["POST"])
def start_timer_route(timer_id):
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    # You can reuse the logic from update_timer or call a helper function
    # For simplicity, we'll just update the state here
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE timers
            SET is_running = 1, start_time = datetime('now', 'localtime'), end_time = NULL, paused_at = NULL
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Timer started successfully"}
    except sqlite3.Error as e:
        logger.error(f"Error starting timer: {e}")
        return {"success": False, "error": "Database error"}, 500

@app.route("/pause_timer/<int:timer_id>", methods=["POST"])
def pause_timer_route(timer_id):
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE timers
            SET is_running = 2, paused_at = datetime('now', 'localtime')
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Timer paused successfully"}
    except sqlite3.Error as e:
        logger.error(f"Error pausing timer: {e}")
        return {"success": False, "error": "Database error"}, 500

@app.route("/resume_timer/<int:timer_id>", methods=["POST"])
def resume_timer_route(timer_id):
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE timers
            SET is_running = 1, paused_at = NULL
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Timer resumed successfully"}
    except sqlite3.Error as e:
        logger.error(f"Error resuming timer: {e}")
        return {"success": False, "error": "Database error"}, 500

@app.route("/stop_timer/<int:timer_id>", methods=["POST"])
def stop_timer_route(timer_id):
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE timers
            SET is_running = 0, end_time = datetime('now', 'localtime')
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Timer stopped successfully"}
    except sqlite3.Error as e:
        logger.error(f"Error stopping timer: {e}")
        return {"success": False, "error": "Database error"}, 500


# Energy Insights API Endpoints

@app.route("/save_energy_insights", methods=["POST"])
def save_energy_insights():
    """Save detailed energy insights from user"""
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    if request.is_json:
        data = request.get_json()
        
        # Required fields
        overall_energy = data.get("overall_energy")
        motivation_level = data.get("motivation_level")
        focus_clarity = data.get("focus_clarity")
        physical_energy = data.get("physical_energy")
        mood_state = data.get("mood_state", "").strip()
        
        # Optional fields
        energy_source = data.get("energy_source", "").strip()
        energy_drains = data.get("energy_drains", "").strip()
        notes = data.get("notes", "").strip()
        
        # Validate required fields
        if not all([overall_energy, motivation_level, focus_clarity, physical_energy, mood_state]):
            return {"error": "All energy levels and mood state are required"}, 400
        
        # Validate numeric fields
        try:
            overall_energy = int(overall_energy)
            motivation_level = int(motivation_level)
            focus_clarity = int(focus_clarity)
            physical_energy = int(physical_energy)
            
            for level in [overall_energy, motivation_level, focus_clarity, physical_energy]:
                if not (1 <= level <= 10):
                    return {"error": "All energy levels must be between 1 and 10"}, 400
        except (ValueError, TypeError):
            return {"error": "Energy levels must be numbers"}, 400
        
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO energy_insights 
                (user_id, overall_energy, motivation_level, focus_clarity, physical_energy, 
                 mood_state, energy_source, energy_drains, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (session['user_id'], overall_energy, motivation_level, focus_clarity, 
                  physical_energy, mood_state, energy_source, energy_drains, notes))
            
            conn.commit()
            conn.close()
            
            return {
                "success": True,
                "message": "Energy insights saved successfully"
            }, 200
        except sqlite3.Error as e:
            logger.error("Error saving energy insights: %s", str(e))
            return {"error": "Database error"}, 500
    
    return {"error": "Invalid request"}, 400


@app.route("/get_energy_insights", methods=["GET"])
def get_energy_insights():
    """Get energy insights for the user"""
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get recent insights with optional limit
        limit = request.args.get('limit', 10, type=int)
        
        cursor.execute("""
            SELECT * FROM energy_insights
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        """, (session['user_id'], limit))
        
        insights = []
        for row in cursor:
            insights.append({
                "id": row["id"],
                "overall_energy": row["overall_energy"],
                "motivation_level": row["motivation_level"],
                "focus_clarity": row["focus_clarity"],
                "physical_energy": row["physical_energy"],
                "mood_state": row["mood_state"],
                "energy_source": row["energy_source"],
                "energy_drains": row["energy_drains"],
                "notes": row["notes"],
                "timestamp": row["timestamp"]
            })
        
        conn.close()
        
        return {"insights": insights}, 200
    except sqlite3.Error as e:
        logger.error("Error getting energy insights: %s", str(e))
        return {"error": "Database error"}, 500


# Routes for audio files
@app.route('/static/audio/<filename>')
def serve_audio(filename):
    """Serve audio files from the static/audio directory"""
    return app.send_static_file(f'audio/{filename}')


@app.route("/settings", methods=["GET", "POST"])
def settings():
    """Settings Page with Account Management and Privacy Policy"""
    if 'user_id' not in session:
        flash("Please login first!", "error")
        return redirect(url_for("login"))

    username = session.get('username', '')
    
    if request.method == "POST":
        action = request.form.get("action")
        
        if action == "update_username":
            new_username = request.form.get("new_username", "").strip()
            password = request.form.get("current_password", "").strip()
            
            # Validate inputs
            if not new_username or not password:
                flash("Both new username and current password are required!", "error")
            else:
                # Verify current password
                user = validate_user(username, password)
                if not user:
                    flash("Current password is incorrect!", "error")
                else:
                    # Check if new username already exists
                    try:
                        conn = sqlite3.connect(DB_PATH)
                        cursor = conn.cursor()
                        cursor.execute("SELECT username FROM users WHERE username = ? AND id != ?", 
                                    (new_username, session['user_id']))
                        if cursor.fetchone():
                            flash("Username already exists. Please choose a different one.", "error")
                        else:
                            # Update username
                            cursor.execute("UPDATE users SET username = ? WHERE id = ?", 
                                        (new_username, session['user_id']))
                            conn.commit()
                            session['username'] = new_username
                            flash("Username updated successfully!", "success")
                        conn.close()
                    except sqlite3.Error as e:
                        logger.error("Error updating username: %s", str(e))
                        flash("Failed to update username.", "error")
                        
        elif action == "update_password":
            current_password = request.form.get("current_password", "").strip()
            new_password = request.form.get("new_password", "").strip()
            confirm_password = request.form.get("confirm_password", "").strip()
            
            # Validate inputs
            if not current_password or not new_password or not confirm_password:
                flash("All password fields are required!", "error")
            elif new_password != confirm_password:
                flash("New passwords do not match!", "error")
            else:
                # Verify current password
                user = validate_user(username, current_password)
                if not user:
                    flash("Current password is incorrect!", "error")
                else:
                    # Validate new password
                    is_valid, message = validate_password(new_password)
                    if not is_valid:
                        flash(message, "error")
                    else:
                        # Update password
                        try:
                            conn = sqlite3.connect(DB_PATH)
                            cursor = conn.cursor()
                            hashed_password = generate_password_hash(new_password)
                            cursor.execute("UPDATE users SET password = ? WHERE id = ?", 
                                        (hashed_password, session['user_id']))
                            conn.commit()
                            conn.close()
                            flash("Password updated successfully!", "success")
                        except sqlite3.Error as e:
                            logger.error("Error updating password: %s", str(e))
                            flash("Failed to update password.", "error")
    
    last_updated = datetime.now().strftime("%B %d, %Y")
    return render_template("settings.html", username=username, last_updated=last_updated)


@app.route("/export_user_data")
def export_user_data():
    """Export all user data in JSON format"""
    if 'user_id' not in session:
        flash("Please login first!", "error")
        return redirect(url_for("login"))
    
    try:
        user_id = session['user_id']
        username = session['username']
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get user account info (excluding password)
        cursor.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
        user_data = dict(cursor.fetchone())
        
        # Get user timers
        cursor.execute("SELECT * FROM timers WHERE user_id = ?", (user_id,))
        timers = [dict(row) for row in cursor.fetchall()]
        
        # Get flow shelf items
        cursor.execute("SELECT * FROM flow_shelf WHERE user_id = ?", (user_id,))
        flow_shelf = [dict(row) for row in cursor.fetchall()]
        
        # Get energy logs
        cursor.execute("SELECT * FROM energy_logs WHERE user_id = ?", (user_id,))
        energy_logs = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        # Compile all user data
        data = {
            'user': user_data,
            'timers': timers,
            'flow_shelf': flow_shelf,
            'energy_logs': energy_logs,
            'export_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Create a JSON response with a file download
        response = app.response_class(
            response=json.dumps(data, indent=4),
            mimetype='application/json'
        )
        response.headers["Content-Disposition"] = f"attachment; filename=deepflow_data_{username}_{datetime.now().strftime('%Y%m%d')}.json"
        
        return response
        
    except sqlite3.Error as e:
        logger.error("Error exporting user data: %s", str(e))
        flash("Failed to export user data.", "error")
        return redirect(url_for("dashboard"))

@app.route("/delete_account", methods=["GET", "POST"])
def delete_account():
    """Delete user account and all associated data"""
    if 'user_id' not in session:
        flash("Please login first!", "error")
        return redirect(url_for("login"))
    
    if request.method == "GET":
        # Show confirmation page
        return render_template("delete_account.html")
    
    try:
        user_id = session['user_id']
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Delete all user data in correct order (respecting foreign keys)
        cursor.execute("DELETE FROM energy_logs WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM flow_shelf WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM timers WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        
        conn.commit()
        conn.close()
        
        # Clear session
        session.clear()
        
        flash("Your account and all associated data have been permanently deleted.", "success")
        return redirect(url_for("home"))
        
    except sqlite3.Error as e:
        logger.error("Error deleting user account: %s", str(e))
        flash("Failed to delete account. Please try again.", "error")
        return redirect(url_for("dashboard"))

@app.route("/privacy")
def privacy():
    """Show the privacy policy as a standalone page"""
    current_date = datetime.now().strftime("%B %d, %Y")
    return render_template("privacy_policy.html", current_date=current_date)

@app.route("/privacy-public")
def privacy_public():
    """Show the public privacy policy page (no login required)"""
    return render_template("privacy_policy_public.html")

@app.route("/privacy-user")
def privacy_user():
    """Show the user privacy policy page (login required)"""
    if 'user_id' not in session:
        flash("Please login to view the full privacy policy.", "error")
        return redirect(url_for("login"))
    return render_template("privacy_policy_user.html")

if __name__ == "__main__":
    app.run(debug=True, port=5003)