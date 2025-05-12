from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from werkzeug.security import generate_password_hash, check_password_hash

# Base class for ORM models
Base = declarative_base()

# User model
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    tasks = relationship('Task', back_populates='user')  # Rename relationship to "tasks"

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

# Task model
class Task(Base):  # Rename model to "Task" for clarity
    __tablename__ = 'tasks'  # Consistent table name
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    task = Column(String, nullable=False)
    done = Column(Boolean, nullable=False)
    user = relationship('User', back_populates='tasks')  # Rename relationship to "tasks"

# Database setup
def init_db():
    engine = create_engine('sqlite:///Deepflow.db')  # Consistent naming
    Base.metadata.create_all(engine)
    print('Database and tables created successfully')

if __name__ == "__main__":
    init_db()