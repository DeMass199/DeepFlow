import sqlite3
import os

# Get the absolute path to the database file, ensuring it's in the same directory as this script
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Deepflow.db')

def setup_database():
    conn = sqlite3.connect(DB_PATH) 
    cursor = conn.cursor()
    
    # Create the users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)
    
    # Create the timers table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS timers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            duration INTEGER NOT NULL, -- Duration in seconds
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
            stage TEXT NOT NULL,  -- 'start' or 'end'
            energy_level INTEGER NOT NULL,  -- 1-10
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (timer_id) REFERENCES timers (id)
        )
    """)
    
    conn.commit()
    conn.close()
    print(f"Database setup complete at {DB_PATH}")

if __name__ == "__main__":
    setup_database()