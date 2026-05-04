import requests
import json
import re

def generate_summary(transcript):

    prompt = f"""You are an expert AI meeting analyst. Analyze the meeting transcript below carefully and extract the following.

IMPORTANT RULES:
- You MUST return ONLY valid JSON, no explanation text before or after.
- You MUST always include a minimum of 5 action items. If the transcript does not have explicit ones, infer reasonable follow-up tasks from the discussion topics.
- The summary must use markdown formatting: use **bold** for key topics/terms, *italics* for emphasis, and structure it into 2-3 short punchy paragraphs (not one long block of text).
- The meeting_title must be a concise, meaningful 4-8 word title that captures what the meeting was actually about (e.g. "Q3 Product Roadmap Review", "Engineering Incident Post-Mortem", "Sales Pipeline Strategy Call"). Do NOT use generic names like "Meeting" or "Discussion".

Return this exact JSON structure:

{{
  "meeting_title": "...",
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
            "model": "llama3.2:1b",
            "prompt": prompt,
            "stream": False
        }
    )

    try:
        response_json = response.json()
        if "response" not in response_json:
            error_msg = response_json.get("error", "Unknown LLM error")
            return {
                "meeting_title": "Untitled Meeting",
                "summary": f"LLM Generation Failed: {error_msg}",
                "action_items": [],
                "decisions": [],
                "open_issues": []
            }

        text = response_json["response"]

        # Extract JSON block even if the model wraps it in markdown code fences
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(text)

    except Exception as e:
        text_fallback = text if 'text' in locals() else str(e)
        return {
            "meeting_title": "Untitled Meeting",
            "summary": text_fallback,
            "action_items": [],
            "decisions": [],
            "open_issues": []
        }