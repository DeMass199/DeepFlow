from flask import Flask, request, render_template, redirect, url_for, flash, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
import logging
from datetime import datetime, timedelta, timezone

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder="templates")  # Explicitly set the templates folder
app.secret_key = os.environ.get('SECRET_KEY', 'default_secret_key')

# Ensure DB_PATH points to Deepflow.db
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Deepflow.db')

def convert_to_user_timezone(timestamp_str, timezone_offset_hours):
    """
    Convert a timestamp string to the user's timezone.
    
    Args:
        timestamp_str: The timestamp string in format 'YYYY-MM-DD HH:MM:SS'
        timezone_offset_hours: The timezone offset in hours (e.g., 10 for AEST, -5 for EST)
    
    Returns:
        A datetime object adjusted to the user's timezone
    """
    try:
        # Parse the timestamp as UTC (SQLite stores in server local time, treat as UTC for conversion)
        dt = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
        
        # Create timezone offset
        offset = timezone(timedelta(hours=timezone_offset_hours))
        
        # Apply the timezone
        dt_with_tz = dt.replace(tzinfo=timezone.utc).astimezone(offset)
        
        return dt_with_tz
    except (ValueError, TypeError) as e:
        logger.error("Error converting timestamp %s with offset %s: %s", 
                    timestamp_str, timezone_offset_hours, str(e))
        # Return original datetime if conversion fails
        return datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')

def get_user_timezone_offset(user_id):
    """Get the user's timezone offset from their country and state preferences."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT country, state_province FROM users WHERE id = ?", (user_id,))
        result = cursor.fetchone()
        country = result[0] if result else 'AU'
        state_province = result[1] if result and result[1] else ''
        conn.close()
        
        # Use the same timezone mapping logic from get_user_preferences
        timezone_mappings = {
            'US': {
                'default': 10,  # Default to AEST for Australia (changed from -5)
                'states': {
                    'CA': -8,   # Pacific
                    'NY': -5,   # Eastern
                    'TX': -6,   # Central
                    'FL': -5,   # Eastern
                    'IL': -6,   # Central
                    'WA': -8,   # Pacific
                    'CO': -7,   # Mountain
                    'AZ': -7,   # Mountain (no DST)
                    'HI': -10,  # Hawaii
                    'AK': -9,   # Alaska
                }
            },
            'AU': {
                'default': 10,
                'states': {
                    'NSW': 10,    # AEST
                    'VIC': 10,    # AEST
                    'QLD': 10,    # AEST (no DST)
                    'WA': 8,      # AWST
                    'SA': 9.5,    # ACST
                    'TAS': 10,    # AEST
                    'NT': 9.5,    # ACST (no DST)
                    'ACT': 10,    # AEST
                }
            },
            'CA': {
                'default': -5,
                'provinces': {
                    'ON': -5,     # Eastern
                    'QC': -5,     # Eastern
                    'BC': -8,     # Pacific
                    'AB': -7,     # Mountain
                    'SK': -6,     # Central
                    'MB': -6,     # Central
                    'NB': -4,     # Atlantic
                    'NS': -4,     # Atlantic
                    'PE': -4,     # Atlantic
                    'NL': -3.5,   # Newfoundland
                }
            },
            'UK': {'default': 0},
            'DE': {'default': 1},
            'FR': {'default': 1},
            'ES': {'default': 1},
            'IT': {'default': 1},
            'JP': {'default': 9},
            'CN': {'default': 8},
            'IN': {'default': 5.5},
            'BR': {
                'default': -3,
                'states': {
                    'SP': -3,     # BRT
                    'RJ': -3,     # BRT
                    'AC': -5,     # ACT
                    'AM': -4,     # AMT
                }
            }
        }
        
        country_data = timezone_mappings.get(country, timezone_mappings['AU'])  # Default to AU
        
        # Check for state/province specific timezone
        if state_province and isinstance(country_data, dict):
            for region_key in ['states', 'provinces']:
                if region_key in country_data and state_province in country_data[region_key]:
                    return country_data[region_key][state_province]
        
        return country_data.get('default', 10)  # Default to AEST (Australia) if not found
        
    except (sqlite3.Error, ValueError, TypeError) as e:
        logger.error("Error getting user timezone offset: %s", str(e))
        return 10  # Default to AEST (Australia) on error

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
                password TEXT NOT NULL,
                country TEXT DEFAULT 'AU',
                state_province TEXT DEFAULT NULL
            )
        """)
        
        # Add country column if it doesn't exist (for existing databases)
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'AU'")
        except sqlite3.OperationalError:
            # Column already exists
            pass
            
        # Add state_province column if it doesn't exist (for existing databases)
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN state_province TEXT DEFAULT NULL")
        except sqlite3.OperationalError:
            # Column already exists
            pass
        
        # Add elapsed_time column if it doesn't exist (for existing databases)
        try:
            cursor.execute("ALTER TABLE timers ADD COLUMN elapsed_time INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            # Column already exists
            pass
        
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
                elapsed_time INTEGER DEFAULT 0, -- Time elapsed before pause (in milliseconds)
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
            session['just_logged_in'] = True  # Flag for first dashboard visit
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

    # If the user just logged in, reset any running or paused timers
    if session.pop('just_logged_in', False):
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            # Reset any timers that were running or paused
            cursor.execute("""
                UPDATE timers 
                SET is_running = 0, start_time = NULL, end_time = NULL, paused_at = NULL
                WHERE user_id = ? AND is_running IN (1, 2)
            """, (user_id,))
            conn.commit()
            conn.close()
            logger.info("Reset all active timers for user %d on new login.", user_id)
        except sqlite3.Error as e:
            logger.error("Error resetting timers for user %d on login: %s", user_id, str(e))
            flash("There was an issue resetting your timer states.", "error")

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
                SET is_running = 1, start_time = datetime('now', 'localtime'), 
                    end_time = NULL, paused_at = NULL, elapsed_time = 0
                WHERE id = ? AND user_id = ?
            """, (timer_id, session['user_id']))
            logger.debug("Started timer %d", timer_id)
        elif action == "pause":
            # Calculate elapsed time since start and store it in milliseconds
            cursor.execute("""
                SELECT start_time, elapsed_time FROM timers
                WHERE id = ? AND user_id = ?
            """, (timer_id, session['user_id']))
            timer_data = cursor.fetchone()
            
            if timer_data and timer_data[0]:  # start_time exists
                start_time_str = timer_data[0]
                current_elapsed = timer_data[1] or 0
                
                # Parse the start time and calculate elapsed milliseconds
                start_time = datetime.strptime(start_time_str, '%Y-%m-%d %H:%M:%S')
                current_time = datetime.now()
                session_elapsed = int((current_time - start_time).total_seconds() * 1000)  # Convert to milliseconds
                total_elapsed = current_elapsed + session_elapsed
                
                cursor.execute("""
                    UPDATE timers
                    SET is_running = 2, paused_at = datetime('now', 'localtime'),
                        elapsed_time = ?
                    WHERE id = ? AND user_id = ?
                """, (total_elapsed, timer_id, session['user_id']))
                logger.debug("Paused timer %d with total elapsed time: %d milliseconds", timer_id, total_elapsed)
            else:
                # If no start_time, just set to paused
                cursor.execute("""
                    UPDATE timers
                    SET is_running = 2, paused_at = datetime('now', 'localtime')
                    WHERE id = ? AND user_id = ?
                """, (timer_id, session['user_id']))
                logger.debug("Paused timer %d (no start time)", timer_id)
        elif action == "resume":
            # When resuming, set new start_time and keep elapsed_time
            cursor.execute("""
                UPDATE timers
                SET is_running = 1, start_time = datetime('now', 'localtime'), paused_at = NULL
                WHERE id = ? AND user_id = ?
            """, (timer_id, session['user_id']))
            logger.debug("Resumed timer %d", timer_id)
        elif action == "stop":
            # Calculate final elapsed time when stopping in milliseconds
            cursor.execute("""
                SELECT start_time, elapsed_time, is_running FROM timers
                WHERE id = ? AND user_id = ?
            """, (timer_id, session['user_id']))
            timer_data = cursor.fetchone()
            
            total_elapsed = 0
            if timer_data:
                current_elapsed = timer_data[1] or 0
                is_currently_running = timer_data[2]
                
                # If timer is currently running (not paused), add current session time
                if is_currently_running == 1 and timer_data[0]:  # Running and has start_time
                    start_time_str = timer_data[0]
                    start_time = datetime.strptime(start_time_str, '%Y-%m-%d %H:%M:%S')
                    current_time = datetime.now()
                    session_elapsed = int((current_time - start_time).total_seconds() * 1000)  # Convert to milliseconds
                    total_elapsed = current_elapsed + session_elapsed
                else:
                    # Timer was paused, use stored elapsed time (already in milliseconds)
                    total_elapsed = current_elapsed
            
            cursor.execute("""
                UPDATE timers
                SET is_running = 0, end_time = datetime('now', 'localtime'),
                    elapsed_time = ?, start_time = NULL, paused_at = NULL
                WHERE id = ? AND user_id = ?
            """, (total_elapsed, timer_id, session['user_id']))
            logger.debug("Stopped timer %d with final elapsed time: %d milliseconds", timer_id, total_elapsed)
        
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


# Helper functions for user preferences

def get_user_feature_preferences(user_id):
    """Get user's feature preferences as a dictionary"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Ensure user_preferences table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                enable_start_checkin BOOLEAN DEFAULT 1,
                enable_mid_checkin BOOLEAN DEFAULT 1,
                enable_end_checkin BOOLEAN DEFAULT 1,
                enable_energy_log BOOLEAN DEFAULT 1,
                enable_sound BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Add new columns if they don't exist (for existing databases)
        try:
            cursor.execute("ALTER TABLE user_preferences ADD COLUMN enable_start_checkin BOOLEAN DEFAULT 1")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE user_preferences ADD COLUMN enable_mid_checkin BOOLEAN DEFAULT 1")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE user_preferences ADD COLUMN enable_end_checkin BOOLEAN DEFAULT 1")
        except sqlite3.OperationalError:
            pass
        
        # Get user preferences
        cursor.execute("""
            SELECT enable_start_checkin, enable_mid_checkin, enable_end_checkin, 
                   enable_energy_log, enable_sound
            FROM user_preferences
            WHERE user_id = ?
        """, (user_id,))
        
        prefs = cursor.fetchone()
        
        if not prefs:
            # Create default preferences for new user
            cursor.execute("""
                INSERT INTO user_preferences (user_id, enable_start_checkin, enable_mid_checkin, 
                                            enable_end_checkin, enable_energy_log, enable_sound)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, 1, 1, 1, 1, 0))
            conn.commit()
            prefs = (1, 1, 1, 1, 0)  # Default values
        
        conn.close()
        
        return {
            "enable_start_checkin": bool(prefs[0]),
            "enable_mid_checkin": bool(prefs[1]),
            "enable_end_checkin": bool(prefs[2]),
            "enable_energy_log": bool(prefs[3]),
            "enable_sound": bool(prefs[4])
        }
        
    except sqlite3.Error as e:
        logger.error("Error getting user preferences: %s", str(e))
        # Return defaults if there's an error
        return {
            "enable_start_checkin": True,
            "enable_mid_checkin": True,
            "enable_end_checkin": True,
            "enable_energy_log": True,
            "enable_sound": False
        }

def is_feature_enabled(user_id, feature_name):
    """Check if a specific feature is enabled for a user"""
    prefs = get_user_feature_preferences(user_id)
    return prefs.get(feature_name, True)  # Default to True if feature not found

# New API endpoints for advanced DeepFlow features

# User Preferences API Endpoints

@app.route("/get_user_preferences", methods=["GET"])
def get_user_preferences():
    """Get user's advanced feature preferences"""
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Add user_preferences table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                enable_start_checkin BOOLEAN DEFAULT 1,
                enable_mid_checkin BOOLEAN DEFAULT 1,
                enable_end_checkin BOOLEAN DEFAULT 1,
                enable_energy_log BOOLEAN DEFAULT 1,
                enable_sound BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Get user preferences
        cursor.execute("""
            SELECT enable_start_checkin, enable_mid_checkin, enable_end_checkin,
                   enable_energy_log, enable_sound
            FROM user_preferences
            WHERE user_id = ?
        """, (session['user_id'],))
        
        prefs = cursor.fetchone()
        
        if not prefs:
            # Create default preferences for new user
            cursor.execute("""
                INSERT INTO user_preferences (user_id, enable_start_checkin, enable_mid_checkin,
                                            enable_end_checkin, enable_energy_log, enable_sound)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (session['user_id'], 1, 1, 1, 1, 0))
            conn.commit()
            prefs = (1, 1, 1, 1, 0)  # Default values
        
        conn.close()
        
        return {
            "success": True,
            "preferences": {
                "enable_start_checkin": bool(prefs[0]),
                "enable_mid_checkin": bool(prefs[1]),
                "enable_end_checkin": bool(prefs[2]),
                "enable_energy_log": bool(prefs[3]),
                "enable_sound": bool(prefs[4])
            }
        }, 200
        
    except sqlite3.Error as e:
        logger.error("Error getting user preferences: %s", str(e))
        return {"error": "Database error"}, 500


@app.route("/update_user_preferences", methods=["POST"])
def update_user_preferences():
    """Update user's advanced feature preferences"""
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    if request.is_json:
        data = request.get_json()
        
        enable_start_checkin = data.get("enable_start_checkin", True)
        enable_mid_checkin = data.get("enable_mid_checkin", True)
        enable_end_checkin = data.get("enable_end_checkin", True)
        enable_energy_log = data.get("enable_energy_log", True)
        enable_sound = data.get("enable_sound", False)
        
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Update or insert preferences
            cursor.execute("""
                INSERT OR REPLACE INTO user_preferences 
                (user_id, enable_start_checkin, enable_mid_checkin, enable_end_checkin,
                 enable_energy_log, enable_sound)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (session['user_id'], enable_start_checkin, enable_mid_checkin, enable_end_checkin,
                  enable_energy_log, enable_sound))
            
            conn.commit()
            conn.close()
            
            return {
                "success": True,
                "message": "Preferences updated successfully"
            }, 200
            
        except sqlite3.Error as e:
            logger.error("Error updating user preferences: %s", str(e))
            return {"error": "Database error"}, 500
    
    return {"error": "Invalid request"}, 400

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
        stage = data.get("stage")  # 'start', 'mid', or 'end'
        energy_level = data.get("energy_level")  # 1-10
        focus_level = data.get("focus_level")  # 1-10 (optional)
        
        if not all([timer_id, stage, energy_level]):
            return {"error": "Timer ID, stage, and energy level are required"}, 400
        
        if stage not in ['start', 'mid', 'end']:
            return {"error": "Stage must be 'start', 'mid', or 'end'"}, 400
        
        # Check if the specific type of check-in is enabled for this user
        prefs = get_user_feature_preferences(session['user_id'])
        stage_enabled = False
        
        if stage == 'start' and prefs.get('enable_start_checkin', True):
            stage_enabled = True
        elif stage == 'mid' and prefs.get('enable_mid_checkin', True):
            stage_enabled = True
        elif stage == 'end' and prefs.get('enable_end_checkin', True):
            stage_enabled = True
        
        if not stage_enabled:
            return {"error": f"{stage.capitalize()} check-in is disabled for this user"}, 403
        
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
            
            # Insert energy log for simple tracking
            cursor.execute("""
                INSERT INTO energy_logs (user_id, timer_id, stage, energy_level)
                VALUES (?, ?, ?, ?)
            """, (session['user_id'], timer_id, stage, energy_level))

            # Also insert into the detailed energy_insights table for graphing
            # We'll use the single energy_level for all numeric insight fields
            # and provide default values for text fields.
            cursor.execute("""
                INSERT INTO energy_insights 
                (user_id, overall_energy, motivation_level, focus_clarity, physical_energy, 
                 mood_state, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (session['user_id'], energy_level, energy_level, energy_level, 
                  energy_level, 'check-in', f'Logged from timer {stage}'))

            # If the stage is 'start', also start the timer
            if stage == 'start':
                cursor.execute("""
                    UPDATE timers
                    SET is_running = 1, start_time = datetime('now', 'localtime'), 
                        end_time = NULL, paused_at = NULL, elapsed_time = 0
                    WHERE id = ? AND user_id = ?
                """, (timer_id, session['user_id']))
                logger.debug("Timer %d started automatically after energy log.", timer_id)
            elif stage == 'end':
                cursor.execute("""
                    UPDATE timers
                    SET is_running = 0, end_time = datetime('now', 'localtime')
                    WHERE id = ? AND user_id = ?
                """, (timer_id, session['user_id']))
                logger.debug("Timer %d stopped automatically after energy log.", timer_id)
            
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
    """Get energy logs for the user from both energy_logs and energy_insights"""
    if 'user_id' not in session:
        return {"error": "Not authenticated", "success": False}, 401
    
    user_id = session['user_id']
    
    try:
        # Get user's timezone offset
        timezone_offset = get_user_timezone_offset(user_id)
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        all_logs = []
        
        # Get logs from energy_logs (check-ins)
        cursor.execute("""
            SELECT 
                e.timestamp,
                e.energy_level,
                t.name as timer_name,
                e.stage
            FROM energy_logs e
            JOIN timers t ON e.timer_id = t.id
            WHERE e.user_id = ?
        """, (user_id,))
        
        for row in cursor.fetchall():
            # Convert timestamp to user's timezone
            adjusted_time = convert_to_user_timezone(row["timestamp"], timezone_offset)
            all_logs.append({
                "type": "check-in",
                "timestamp": adjusted_time.strftime('%Y-%m-%d %H:%M:%S'),
                "energy_level": row["energy_level"],
                "timer_name": row["timer_name"],
                "stage": row["stage"]
            })
            
        # Get logs from energy_insights (detailed insights)
        cursor.execute("""
            SELECT 
                timestamp,
                overall_energy
            FROM energy_insights
            WHERE user_id = ?
        """, (user_id,))

        for row in cursor.fetchall():
            # Convert timestamp to user's timezone
            adjusted_time = convert_to_user_timezone(row["timestamp"], timezone_offset)
            all_logs.append({
                "type": "insight",
                "timestamp": adjusted_time.strftime('%Y-%m-%d %H:%M:%S'),
                "energy_level": row["overall_energy"]
            })
        
        conn.close()
        
        # Sort all logs by timestamp in ascending order for the chart
        all_logs.sort(key=lambda x: x['timestamp'])
        
        return {"success": True, "logs": all_logs}, 200
        
    except sqlite3.Error as e:
        logger.error("Error getting combined energy logs: %s", str(e))
        return {"error": "Database error", "success": False}, 500


# New timer control routes
@app.route("/start_timer/<int:timer_id>", methods=["POST"])
def start_timer_route(timer_id):
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE timers
            SET is_running = 1, start_time = datetime('now', 'localtime'), 
                end_time = NULL, paused_at = NULL, elapsed_time = 0
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Timer started successfully"}
    except sqlite3.Error as e:
        logger.error("Error starting timer: %s", e)
        return {"success": False, "error": "Database error"}, 500


@app.route("/pause_timer/<int:timer_id>", methods=["POST"])
def pause_timer_route(timer_id):
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get current timer state
        cursor.execute("""
            SELECT start_time, elapsed_time FROM timers
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        timer_data = cursor.fetchone()
        
        if timer_data and timer_data[0]:  # start_time exists
            start_time_str = timer_data[0]
            current_elapsed = timer_data[1] or 0
            
            # Calculate elapsed time in milliseconds
            start_time = datetime.strptime(start_time_str, '%Y-%m-%d %H:%M:%S')
            current_time = datetime.now()
            session_elapsed = int((current_time - start_time).total_seconds() * 1000)  # Convert to milliseconds
            total_elapsed = current_elapsed + session_elapsed
            
            cursor.execute("""
                UPDATE timers
                SET is_running = 2, paused_at = datetime('now', 'localtime'),
                    elapsed_time = ?
                WHERE id = ? AND user_id = ?
            """, (total_elapsed, timer_id, session['user_id']))
        else:
            cursor.execute("""
                UPDATE timers
                SET is_running = 2, paused_at = datetime('now', 'localtime')
                WHERE id = ? AND user_id = ?
            """, (timer_id, session['user_id']))
        
        conn.commit()
        conn.close()
        return {"success": True, "message": "Timer paused successfully"}
    except sqlite3.Error as e:
        logger.error("Error pausing timer: %s", e)
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
            SET is_running = 1, start_time = datetime('now', 'localtime'), paused_at = NULL
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Timer resumed successfully"}
    except sqlite3.Error as e:
        logger.error("Error resuming timer: %s", e)
        return {"success": False, "error": "Database error"}, 500


@app.route("/stop_timer/<int:timer_id>", methods=["POST"])
def stop_timer_route(timer_id):
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Calculate final elapsed time
        cursor.execute("""
            SELECT start_time, elapsed_time, is_running FROM timers
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        timer_data = cursor.fetchone()
        
        total_elapsed = 0
        if timer_data:
            current_elapsed = timer_data[1] or 0
            is_currently_running = timer_data[2]
            
            # If timer is currently running, add current session time
            if is_currently_running == 1 and timer_data[0]:  # Running and has start_time
                start_time_str = timer_data[0]
                start_time = datetime.strptime(start_time_str, '%Y-%m-%d %H:%M:%S')
                current_time = datetime.now()
                session_elapsed = int((current_time - start_time).total_seconds() * 1000)  # Convert to milliseconds
                total_elapsed = current_elapsed + session_elapsed
            else:
                # Timer was paused, use stored elapsed time (already in milliseconds)
                total_elapsed = current_elapsed
        
        cursor.execute("""
            UPDATE timers
            SET is_running = 0, end_time = datetime('now', 'localtime'),
                elapsed_time = ?, start_time = NULL, paused_at = NULL
            WHERE id = ? AND user_id = ?
        """, (total_elapsed, timer_id, session['user_id']))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Timer stopped successfully"}
    except sqlite3.Error as e:
        logger.error("Error stopping timer: %s", e)
        return {"success": False, "error": "Database error"}, 500


@app.route("/get_timer_state/<int:timer_id>", methods=["GET"])
def get_timer_state(timer_id):
    """Get the current state of a timer including elapsed time and duration"""
    if 'user_id' not in session:
        return {"error": "Not authenticated"}, 401
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, name, duration, start_time, elapsed_time, is_running
            FROM timers
            WHERE id = ? AND user_id = ?
        """, (timer_id, session['user_id']))
        
        timer_data = cursor.fetchone()
        conn.close()
        
        if not timer_data:
            return {"error": "Timer not found"}, 404
        
        timer_id, name, duration, start_time, elapsed_time, is_running = timer_data
        
        # Calculate current elapsed time if timer is running
        current_elapsed = elapsed_time or 0
        if is_running == 1 and start_time:  # Timer is running
            start_time_obj = datetime.strptime(start_time, '%Y-%m-%d %H:%M:%S')
            current_time = datetime.now()
            session_elapsed = int((current_time - start_time_obj).total_seconds() * 1000)
            current_elapsed += session_elapsed
        
        return {
            "success": True,
            "timer": {
                "id": timer_id,
                "name": name,
                "duration": duration,  # Duration in seconds
                "elapsed_time": current_elapsed,  # Elapsed time in milliseconds
                "is_running": is_running,
                "remaining_time": max(0, (duration * 1000) - current_elapsed)  # Remaining time in milliseconds
            }
        }, 200
        
    except sqlite3.Error as e:
        logger.error("Error getting timer state: %s", e)
        return {"error": "Database error"}, 500
        
