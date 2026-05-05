# Meeting Intelligence Engine

Meeting Intelligence Engine is a full-stack app that transcribes uploaded meeting audio and extracts structured insights.

Current processing flow:

1. Frontend uploads an audio file to FastAPI.
2. Whisper transcribes speech to text.
3. Ollama (Llama3) extracts summary, action items, decisions, and open issues.
4. Data is stored in PostgreSQL and returned to the frontend.

## Features

- Audio upload from web UI
- Live audio recording with two capture modes:
  - **All Participants**: Captures system audio (other participants) mixed with your microphone (Chrome on Windows).
  - **My Voice Only**: Captures only your microphone.
- Whisper-based transcription
- AI-generated summary and action items
- Decisions and open issues extraction
- Meeting history from PostgreSQL

## Tech Stack

Backend:

- Python 3.10+
- FastAPI
- SQLAlchemy
- PostgreSQL
- openai-whisper
- Ollama (llama3)
- FFmpeg

Frontend:

- React (Create React App)
- Axios

## Project Structure

- backend: FastAPI app, DB models, transcription, LLM integration
- frontend: React app

## Prerequisites

Install before setup:

- Python 3.10+
- Node.js 18+
- PostgreSQL
- FFmpeg
- Ollama

## Backend Setup

From repository root:

```bash
cd backend
python -m venv venv
venv/Scripts/activate
pip install fastapi uvicorn sqlalchemy psycopg2-binary openai-whisper requests python-multipart python-dotenv
```

### Database Configuration

Create a PostgreSQL database named:

```text
meetingdb
```

Configure environment values in backend/.env.

Minimum required option A (split fields):

```env
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meetingdb
```

Option B (single connection string):

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/meetingdb
```

Note: DB_PASSWORD is required when DATABASE_URL is not provided.

### FFmpeg Configuration

Whisper requires ffmpeg available to the backend process.

Option A:

- Add your FFmpeg bin folder to system PATH.

Option B:

- Set FFMPEG_PATH in backend/.env to your FFmpeg bin folder.

Example:

```env
FFMPEG_PATH=C:\ffmpeg\bin
```

Verify from backend environment:

```bash
venv\Scripts\python.exe -c "import shutil; print(shutil.which('ffmpeg'))"
```

If this prints None, uploads will fail.

### Ollama Setup

Install Ollama from:

https://ollama.com

Pull model:

```bash
ollama pull llama3
```

Start Ollama:

```bash
ollama serve
```

Backend expects Ollama at:

```text
http://localhost:11434
```

## Run Backend

From backend folder:

```bash
venv\Scripts\activate
uvicorn main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## Frontend Setup

From repository root:

```bash
cd frontend
npm install
npm start
```

Frontend URL:

```text
http://localhost:3000
```

## API Endpoints

GET /:

- Health message

GET /meetings:

- Returns stored meeting history (id, title, summary, created_at)

POST /upload-audio/:

- Accepts multipart file field named file
- Returns JSON with:
   - summary
   - action_items
   - decisions
   - open_issues

## Run Order

1. Start Ollama server.
2. Start backend (FastAPI).
3. Start frontend (React).

## Troubleshooting

### 500 on POST /upload-audio/

Check these first:

1. FFmpeg is discoverable by backend process.
2. Ollama server is running at localhost:11434.
3. Database credentials in backend/.env are valid.

### Error: ffmpeg is not available

- Ensure FFMPEG_PATH points to the folder containing ffmpeg.exe.
- Restart backend after changing environment values.

### Error: Database password not configured

- Set DB_PASSWORD in backend/.env, or set DATABASE_URL.

## Notes

- Current backend catches runtime transcription/setup errors and returns HTTP 500 with detail.
- Temporary uploaded audio files are cleaned up after processing.

## Author

Devansh Seth, Kartikeya Singh

GitHub: https://github.com/Devansh7617
