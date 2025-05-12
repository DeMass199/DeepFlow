from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from werkzeug.security import generate_password_hash
from Deep_flow_app.db import User, Task  # Replace DeepFlow with Task if that's the correct model name

# Connect to the Deepflow database
engine = create_engine('sqlite:///Deepflow.db')  # Consistent naming
Session = sessionmaker(bind=engine)
session = Session()

# Insert users with hashed passwords
user1 = User(username='Lucas', password=generate_password_hash('password123'))
user2 = User(username='jane_doe', password=generate_password_hash('mypassword'))

session.add(user1)
session.add(user2)
session.commit()

# Refresh to ensure IDs are populated
session.refresh(user1)
session.refresh(user2)

# Insert tasks
task1 = Task(task='Learn SQLAlchemy', done=False, user_id=user1.id)  # Use Task model
task2 = Task(task='Build an app', done=False, user_id=user2.id)      # Use Task model

session.add(task1)
session.add(task2)
session.commit()

print("Users and tasks inserted successfully.")