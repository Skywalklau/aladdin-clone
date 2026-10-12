from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from app.core.config import settings

# the door to the database:
# It knows:
# 1. Where the database is
# 2. What language to speak (SQLite / Postgres / etc.)
# This does NOT store or fetch data yet, it just knows how to connect.
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} # This prevents issues with multiple requests.
)

# The librarian factory
# This does not talk to the database yet.
# Instead, it means:
# “Whenever I ask, create a librarian who can talk to the database.”
# Each librarian:
# 1. Helps one person
# 2. Works for a short time
# 3. Then leaves
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# This just means:
# “All database tables will come from this base class.”
# You don’t use Base directly.
# It’s just a container that remembers all tables.
# eg. 
# class User(Base):
#     __tablename__ = "users"
Base = declarative_base()


# Making sure the librarian always leaves (the get_db() function)
# This looks scary, but the idea is very simple:
# “Give me a librarian, let me use them, and no matter what, send them home.”
# What actually happens:
# 1. db = SessionLocal() -> librarian arrives
# 2. yield db -> your code uses it
# 3. Your code finishes (or crashes)
# 4. db.close() -> librarian leaves
# You don’t manually call close() every time — Python does it for you.
def get_db(): 
    # This line means:
    # “Give me a librarian right now.”
    db = SessionLocal() # A librarian (Session)
    # This db:
    # Can read data
    # Can write data
    # Can save changes
    # Can cancel changes
    # If you don’t close the librarian -> memory + connections leak
    try:
        yield db
        # Why yield and not return?
        # You can think of yield as:
        # “Pause here, let someone else use this, then come back later.”
        # FastAPI uses this trick so it can:
        # 1. Open the database
        # 2. Run your API code
        # 3. Close the database safely
        # yield transforms a regular function into a generator function:
        # def snack_machine():
        #     yield "🍎"
        #     yield "🍌"
        #     yield "🍪"
        # When you call this function, it doesn’t run immediately.
        # Instead, it gives you a generator (a “paused function”)
        # You can ask it for the next snack whenever you want.
        # machine = snack_machine()  # Nothing happens yet
        # next(machine)  # 🍎
        # next(machine)  # 🍌
        # next(machine)  # 🍪
        # yield pauses the function and lets it continue later.
        # pls read sqlalchemy in python from python libraries for backend for more info
    finally: 
        db.close()


#This means:
# “Look at all table definitions and create them in the database.”
def create_tables():
    Base.metadata.create_all(bind=engine)
