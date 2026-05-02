import os
import shutil

from fastapi import FastAPI, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from db import SessionLocal, engine
from models import Base, Meeting, ActionItem, Decision, Issue
from whisper_utils import transcribe_audio
from llm import generate_summary
from fastapi.middleware.cors import CORSMiddleware

# create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Meeting Intelligence Engine Running"}


@app.post("/upload-audio/")
async def upload_audio(file: UploadFile = File(...)):

    # save uploaded file
    file_path = f"temp_{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db: Session | None = None
    try:
        # transcribe audio
        transcript = transcribe_audio(file_path)

        # run LLM analysis
        data = generate_summary(transcript)

        # database session
        db = SessionLocal()

        # store meeting
        meeting = Meeting(
            title=file.filename,
            transcript=transcript,
            summary=data.get("summary", "")
        )

        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        # store action items
        for item in data.get("action_items", []):
            action = ActionItem(
                meeting_id=meeting.id,
                task=item.get("task", ""),
                owner=item.get("owner", ""),
                deadline=item.get("deadline", "")
            )
            db.add(action)

        # store decisions
        for d in data.get("decisions", []):
            decision = Decision(
                meeting_id=meeting.id,
                text=d
            )
            db.add(decision)

        # store issues
        for issue in data.get("open_issues", []):
            issue_obj = Issue(
                meeting_id=meeting.id,
                text=issue
            )
            db.add(issue_obj)

        db.commit()
        return data
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if db is not None:
            db.close()
        if os.path.exists(file_path):
            os.remove(file_path)


@app.get("/meetings")
def get_meetings():

    db: Session = SessionLocal()

    meetings = db.query(Meeting).all()

    results = []

    for m in meetings:
        results.append({
            "id": m.id,
            "title": m.title,
            "summary": m.summary,
            "created_at": m.created_at
        })

    db.close()

    return results