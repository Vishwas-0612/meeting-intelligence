import os
import shutil

import whisper


def _configure_ffmpeg_path():
    ffmpeg_path = os.getenv("FFMPEG_PATH")
    if not ffmpeg_path:
        return

    if os.path.isdir(ffmpeg_path):
        os.environ["PATH"] = ffmpeg_path + os.pathsep + os.environ.get("PATH", "")
        return

    if os.path.isfile(ffmpeg_path):
        os.environ["PATH"] = os.path.dirname(ffmpeg_path) + os.pathsep + os.environ.get("PATH", "")
        

def _ensure_ffmpeg_available():
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            "ffmpeg is not available. Install FFmpeg and add it to PATH, or set FFMPEG_PATH in backend/.env."
        )

model = whisper.load_model("base")


def transcribe_audio(file_path):
    _configure_ffmpeg_path()
    _ensure_ffmpeg_available()
    result = model.transcribe(file_path)
    return result["text"]