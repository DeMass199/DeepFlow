#!/usr/bin/env python3
"""
Migration script to update the timers table with the paused_at column
and modify is_running to support paused state
"""
import sqlite3
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure DB_PATH points to Deepflow.db
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Deepflow.db')

def update_timers_table():
    """Updates the timers table to add paused_at column and modify is_running datatype"""
    conn = None
    try:
        # Check if the database file exists
        if not os.path.exists(DB_PATH):
            logger.error("Database file does not exist at %s", DB_PATH)
            return False

        # Connect to the database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if paused_at column already exists to avoid errors
        cursor.execute("PRAGMA table_info(timers)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'paused_at' not in column_names:
            logger.info("Adding paused_at column to timers table")
            cursor.execute("ALTER TABLE timers ADD COLUMN paused_at TEXT DEFAULT NULL")
        else:
            logger.info("paused_at column already exists in timers table")
        
        # Ensure is_running is INTEGER type so it can store the paused state (2)
        # SQLite doesn't support changing column types directly, so we need to:
        # 1. Rename existing table
        # 2. Create new table with correct structure
        # 3. Copy data
        # 4. Drop old table
        
        # First, check current is_running type
        running_col = next((col for col in columns if col[1] == 'is_running'), None)
        if running_col and running_col[2].upper() == 'BOOLEAN':
            logger.info("Converting is_running from BOOLEAN to INTEGER")
            
            # Step 1: Rename existing table
            cursor.execute("ALTER TABLE timers RENAME TO timers_old")
            
            # Step 2: Create new table with correct structure
            cursor.execute("""
                CREATE TABLE timers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    duration INTEGER NOT NULL,
                    start_time TEXT DEFAULT NULL,
                    end_time TEXT DEFAULT NULL,
                    paused_at TEXT DEFAULT NULL,
                    is_running INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)
            
            # Step 3: Copy data
            cursor.execute("""
                INSERT INTO timers (id, user_id, name, duration, start_time, end_time, is_running)
                SELECT id, user_id, name, duration, start_time, end_time, is_running
                FROM timers_old
            """)
            
            # Step 4: Drop old table
            cursor.execute("DROP TABLE timers_old")
            
            logger.info("Migration completed successfully")
        else:
            logger.info("is_running is already INTEGER type or doesn't exist")
        
        # Commit all changes
        conn.commit()
        logger.info("Database schema updated successfully")
        return True
        
    except sqlite3.Error as e:
        logger.error("Database error: %s", str(e))
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    if update_timers_table():
        print("✅ Migration completed successfully!")
    else:
        print("❌ Migration failed. Check logs for details.")
