import requests
import json
import re

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_TIMEOUT = 600


def _ollama(prompt):
    response = requests.post(
        OLLAMA_URL,
        json={"model": "llama3", "prompt": prompt, "stream": False},
        timeout=OLLAMA_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    if "response" not in data:
        raise ValueError(data.get("error", "Unknown Ollama error"))
    return data["response"].strip()


def _parse_json(text):
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)

    start = text.find("{")
    end = text.rfind("}")

    # If closing brace is missing, try to repair by appending it
    if start != -1 and end == -1:
        text = text + "\n}"
        end = text.rfind("}")

    if start == -1 or end == -1:
        raise ValueError("No JSON object found in LLM response")

    json_str = text[start:end + 1]
    json_str = re.sub(r",\s*([}\]])", r"\1", json_str)   # trailing commas
    json_str = json_str.replace("\u201c", '"').replace("\u201d", '"')
    json_str = json_str.replace("\u2018", "'").replace("\u2019", "'")
    json_str = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", json_str)

    return json.loads(json_str)


def _truncate(transcript, max_words=2500):
    words = transcript.split()
    if len(words) <= max_words:
        return transcript
    return " ".join(words[:max_words]) + "\n\n[Transcript truncated]"


def _extract_title(text):
    for line in text.splitlines():
        line = line.strip().lstrip("#*").strip()
        if 3 < len(line.split()) <= 10 and not line.endswith(":"):
            return line
    return "Untitled Meeting"


def _extract_summary_from_analysis(text):
    """Pull the executive summary paragraphs out of the Step 1 free-text."""
    lines = text.splitlines()
    in_summary = False
    summary_lines = []

    for line in lines:
        stripped = line.strip()
        # Detect start of summary section
        if re.search(r"executive summary", stripped, re.IGNORECASE):
            in_summary = True
            continue
        # Detect start of next section — stop collecting
        if in_summary and re.match(r"\*{0,2}(action items|key decisions|open issues|decisions)", stripped, re.IGNORECASE):
            break
        if in_summary and stripped:
            summary_lines.append(stripped)

    if summary_lines:
        return "\n\n".join(summary_lines)

    # Fallback: return everything if section detection failed
    return text


def generate_summary(transcript):

    # ── Step 1: free-text analysis ───────────────────────────────────────────
    analysis_prompt = """You are an expert meeting analyst. Read the transcript below and extract:

1. A concise meeting title (4-8 words)
2. An executive summary: 2-3 paragraphs using **bold** for key topics and *italics* for emphasis
3. Action items with owner and deadline (at least 5, infer if needed)
4. Key decisions made
5. Open issues or unresolved questions

Transcript:
""" + _truncate(transcript)

    print("=== STEP 1: Sending to Ollama ===")
    analysis_text = _ollama(analysis_prompt)
    print("=== STEP 1 RESPONSE ===")
    print(analysis_text)
    print("=== END ===")

    # Extract summary from analysis immediately — don't rely on Llama3 to fill it in Step 2
    extracted_summary = _extract_summary_from_analysis(analysis_text)
    extracted_title = _extract_title(analysis_text)

    # ── Step 2: convert to strict JSON ───────────────────────────────────────
    json_prompt = """Convert ONLY the action items, decisions, and open issues from the meeting analysis below into JSON.

RULES:
- Return ONLY the JSON object. No explanation, no markdown, no extra text.
- action_items: list of {"task": "...", "owner": "...", "deadline": "..."}
- decisions: list of strings
- open_issues: list of strings
- Do NOT include meeting_title or summary fields.

Required format:
{
  "action_items": [
    {"task": "...", "owner": "...", "deadline": "..."}
  ],
  "decisions": ["..."],
  "open_issues": ["..."]
}

Meeting analysis:
""" + analysis_text

    print("=== STEP 2: Converting to JSON ===")
    json_text = _ollama(json_prompt)
    print("=== STEP 2 RESPONSE ===")
    print(json_text)
    print("=== END ===")

    try:
        parsed = _parse_json(json_text)
        action_items = parsed.get("action_items", [])
        decisions = parsed.get("decisions", [])
        open_issues = parsed.get("open_issues", [])

        if not isinstance(action_items, list):
            action_items = []
        if not isinstance(decisions, list):
            decisions = []
        if not isinstance(open_issues, list):
            open_issues = []

    except (ValueError, json.JSONDecodeError) as e:
        print(f"=== JSON parse failed: {e}, using empty lists ===")
        action_items = []
        decisions = []
        open_issues = []

    return {
        "meeting_title": extracted_title,
        "summary": extracted_summary,
        "action_items": action_items,
        "decisions": decisions,
        "open_issues": open_issues,
    }