from sqlalchemy import Column, Integer, String, Text
from database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), default="Medium")
    deadline = Column(String(100), nullable=True)
    status = Column(String(30), default="Pending")
    action_plan = Column(Text, nullable=True)