from sqlalchemy import Column, Integer, String, Text, DateTime
from db import Base
import datetime

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True)
    title = Column(String)
    transcript = Column(Text)
    summary = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True)
    meeting_id = Column(Integer)
    task = Column(Text)
    owner = Column(String)
    deadline = Column(String)


class Decision(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True)
    meeting_id = Column(Integer)
    text = Column(Text)


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True)
    meeting_id = Column(Integer)
    text = Column(Text)