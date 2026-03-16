import requests
import json

def generate_summary(transcript):

    prompt = f"""
You are an AI meeting assistant.

From the meeting transcript below extract:

1. A short meeting summary
2. Action items
3. Decisions made
4. Open issues

Return the result ONLY as valid JSON in this format:

{{
  "summary": "...",
  "action_items": [
    {{"task": "...", "owner": "...", "deadline": "..."}}
  ],
  "decisions": [],
  "open_issues": []
}}

Transcript:
{transcript}
"""

    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3",
            "prompt": prompt,
            "stream": False
        }
    )

    text = response.json()["response"]

    try:
        return json.loads(text)
    except:
        return {"summary": text, "action_items": [], "decisions": [], "open_issues": []}