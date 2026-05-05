import os
import shutil

from fastapi import FastAPI, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from db import SessionLocal, engine
from models import Base, Meeting, ActionItem, Decision, Issue
from whisper_utils import transcribe_audio
from llm import generate_summary
from fastapi.middleware.cors import CORSMiddleware

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
    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db: Session | None = None
    try:
        transcript = transcribe_audio(file_path)
        data = generate_summary(transcript)
        db = SessionLocal()

        ai_title = data.get("meeting_title") or file.filename
        meeting = Meeting(
            title=ai_title,
            transcript=transcript,
            summary=data.get("summary", "")
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        for item in data.get("action_items", []):
            db.add(ActionItem(
                meeting_id=meeting.id,
                task=item.get("task", ""),
                owner=item.get("owner", ""),
                deadline=item.get("deadline", "")
            ))

        for d in data.get("decisions", []):
            db.add(Decision(meeting_id=meeting.id, text=d))

        for issue in data.get("open_issues", []):
            db.add(Issue(meeting_id=meeting.id, text=issue))

        db.commit()
        data["transcript"] = transcript
        data["meeting_title"] = ai_title
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
        action_items = db.query(ActionItem).filter(ActionItem.meeting_id == m.id).all()
        results.append({
            "id": m.id,
            "title": m.title,
            "transcript": m.transcript,
            "summary": m.summary,
            "created_at": m.created_at,
            "action_items": [
                {"task": a.task, "owner": a.owner, "deadline": a.deadline}
                for a in action_items
            ],
            "meeting_title": m.title,
        })
    db.close()
    return results


@app.delete("/meetings/{meeting_id}")
def delete_meeting(meeting_id: int):
    db: Session = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).delete()
        db.query(Decision).filter(Decision.meeting_id == meeting_id).delete()
        db.query(Issue).filter(Issue.meeting_id == meeting_id).delete()
        db.delete(meeting)
        db.commit()
        return {"message": f"Meeting {meeting_id} deleted."}
    finally:
        db.close()


@app.delete("/meetings")
def clear_meetings():
    db: Session = SessionLocal()
    try:
        db.query(ActionItem).delete()
        db.query(Decision).delete()
        db.query(Issue).delete()
        db.query(Meeting).delete()
        db.commit()
        return {"message": "All meetings cleared."}
    finally:
        db.close()