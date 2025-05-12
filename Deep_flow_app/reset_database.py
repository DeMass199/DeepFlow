import os
import sqlite3
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Get the absolute path to the database file
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Deepflow.db')
logger.info(f"Database path: {DB_PATH}")

def reset_database():
    """Reset and recreate the database with proper schema"""
    # If the database file exists, remove it
    if os.path.exists(DB_PATH):
        logger.info(f"Removing existing database at {DB_PATH}")
        os.remove(DB_PATH)
    
    conn = None
    try:
        logger.info(f"Creating new database at {DB_PATH}")
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
                duration INTEGER NOT NULL,
                start_time TEXT DEFAULT NULL,
                end_time TEXT DEFAULT NULL,
                is_running BOOLEAN NOT NULL DEFAULT 0,
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
                stage TEXT NOT NULL,
                energy_level INTEGER NOT NULL,
                timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (timer_id) REFERENCES timers (id)
            )
        """)
        
        conn.commit()
        logger.info("Database initialized successfully")
        
        # Test inserting a test user
        cursor.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            ("testuser", "hashed_password_here")
        )
        conn.commit()
        logger.info("Test user inserted successfully")
        
        # Verify the user was inserted
        cursor.execute("SELECT * FROM users")
        users = cursor.fetchall()
        logger.info(f"Users in database: {users}")
        
        return True
    except sqlite3.Error as e:
        logger.error(f"Database error: {str(e)}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    reset_database()
    logger.info("Database reset complete")