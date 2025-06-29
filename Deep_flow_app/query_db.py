from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from Deep_flow_app.db import User, Task # Update import to match the new model name

# Connect to the Deepflow database
engine = create_engine('sqlite:///Deepflow.db')  # Consistent naming
Session = sessionmaker(bind=engine)
session = Session()

# Query all users and their tasks
users = session.query(User).all()
for user in users:
    print(f"User: {user.username}")
    for task in user.Deepflow:  # Update to match the relationship name
        print(f' - Task: {task.task}, Done: {task.done}')

session.close()