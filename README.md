# Meeting Intelligence Engine

An AI-powered system that automatically transcribes meeting audio and extracts useful insights such as summaries and action items.

The system converts speech into text and then uses a large language model to analyze the conversation and generate structured meeting information.

---

## Features

- Upload meeting audio files
- Automatic speech transcription
- AI-generated meeting summary
- Action item detection
- Meeting history storage
- Web dashboard interface

---

## Tech Stack

### Backend
- FastAPI
- Python
- Whisper (speech-to-text)
- Ollama + Llama3
- PostgreSQL
- SQLAlchemy
- FFmpeg

### Frontend
- React
- Axios
- CSS

---

## System Architecture

User Uploads Audio  
↓  
React Frontend  
↓  
FastAPI Backend  
↓  
Whisper (Speech → Text)  
↓  
Llama3 via Ollama (Meeting Analysis)  
↓  
PostgreSQL Database  
↓  
Insights Returned to Frontend  

---

## Prerequisites

Install the following software before running the project:

- Python 3.10+
- Node.js (v18+ recommended)
- Git
- PostgreSQL
- FFmpeg
- Ollama

---

## Clone the Repository

```bash
git clone https://github.com/Devansh7617/meeting-intelligence.git
cd meeting-intelligence
```

---

# Backend Setup

Navigate to the backend folder:

```bash
cd backend
```

Create virtual environment:

```bash
python -m venv venv
```

Activate virtual environment (Windows):

```bash
venv\Scripts\activate
```

Install backend dependencies:

```bash
pip install fastapi uvicorn sqlalchemy psycopg2-binary openai-whisper requests python-multipart
```

---

# Install Ollama and Llama3

Download Ollama:

https://ollama.com

Pull the Llama3 model:

```bash
ollama pull llama3
```

Start Ollama server:

```bash
ollama serve
```

---

# Setup PostgreSQL

Create a database called:

```
meetingdb
```

Update database connection in:

```
backend/db.py
```

Example:

```
DATABASE_URL = "postgresql://postgres:yourpassword@localhost:5432/meetingdb"
```

---

# Install FFmpeg

Download FFmpeg from:

https://ffmpeg.org/download.html

Add the FFmpeg `bin` folder to your system PATH.

Verify installation:

```bash
ffmpeg -version
```

---

# Run Backend Server

From the backend folder:

```bash
uvicorn main:app --reload
```

Backend runs at:

```
http://127.0.0.1:8000
```

API documentation:

```
http://127.0.0.1:8000/docs
```

---

# Frontend Setup

Open a new terminal.

Navigate to frontend folder:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

Start React server:

```bash
npm start
```

Frontend runs at:

```
http://localhost:3000
```

---

# Running the Full System

Start services in this order:

1. Start Ollama

```bash
ollama serve
```

2. Start Backend

```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload
```

3. Start Frontend

```bash
cd frontend
npm start
```

Open the application:

```
http://localhost:3000
```

---

# Example Workflow

1. Upload meeting audio file
2. Whisper transcribes speech
3. Llama3 analyzes transcript
4. System generates:
   - Meeting summary
   - Action items
   - Decisions
5. Results displayed on dashboard

---

# Future Improvements

- Speaker diarization
- Real-time meeting transcription
- Meeting analytics
- PDF export for meeting minutes
- User authentication

---

# Author

Devansh Seth

GitHub: https://github.com/Devansh7617
