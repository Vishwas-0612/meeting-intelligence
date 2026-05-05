import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Mic,
  Upload,
  FileAudio,
  LayoutDashboard,
  History,
  CheckCircle2,
  FileText,
  BarChart3,
  Clock,
  User,
  Calendar,
  X,
  Sparkles,
  ChevronRight,
  Trash2,
  Monitor,
  ArrowLeft,
} from "lucide-react";
import "./App.css";

/* ─── Helpers ────────────────────────────────────── */
function wordCount(txt) {
  return txt ? txt.trim().split(/\s+/).filter(Boolean).length : 0;
}
function estimatedMinutes(txt) {
  return (wordCount(txt) / 150).toFixed(1);
}
function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/* ─── Clean summary text ─────────────────────────── */
function cleanSummary(text) {
  if (!text) return "";
  const cutOff = text.search(/###\s*Action Items/i);
  if (cutOff !== -1) text = text.slice(0, cutOff);
  text = text.replace(/^\*?Meeting Title\*?:.*$/gim, "");
  text = text.replace(/^[=\-]{4,}$/gm, "");
  return text.trim();
}

/* ─── Markdown renderer ──────────────────────────── */
function renderMarkdown(rawText) {
  const text = cleanSummary(rawText);
  if (!text)
    return <p className="summary-para" style={{ color: "var(--text-subtle)" }}>No summary generated.</p>;

  const lines = text.split("\n");
  const elements = [];
  let paraLines = [];

  const flushPara = (key) => {
    if (!paraLines.length) return;
    const joined = paraLines.join(" ").trim();
    if (joined) elements.push(<p key={key} className="summary-para">{inlineMarkdown(joined)}</p>);
    paraLines = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || /^[=\-]{3,}$/.test(trimmed)) { flushPara(`p${i}`); return; }
    if (/^#{1,3}\s/.test(trimmed)) {
      flushPara(`p${i}`);
      const heading = trimmed.replace(/^#{1,3}\s+/, "");
      elements.push(<p key={`h${i}`} className="summary-para"><strong style={{ color: "var(--text)", fontSize: "0.95rem" }}>{heading}</strong></p>);
      return;
    }
    if (/^(\d+\.|[-*•])\s/.test(trimmed)) {
      flushPara(`p${i}`);
      const content = trimmed.replace(/^(\d+\.|[-*•])\s+/, "");
      elements.push(
        <p key={`li${i}`} className="summary-para" style={{ paddingLeft: "1.2em", position: "relative" }}>
          <span style={{ position: "absolute", left: 0, color: "var(--brand)" }}>›</span>
          {inlineMarkdown(content)}
        </p>
      );
      return;
    }
    paraLines.push(trimmed);
  });
  flushPara("final");
  return elements;
}

function inlineMarkdown(text) {
  const parts = [];
  const regex = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0, m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index}><em>{m[1]}</em></strong>);
    else if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const LABELS = [
  "Parsing audio metadata…",
  "Running speech-to-text…",
  "Extracting key topics…",
  "Identifying action items…",
  "Generating summary…",
];

export default function App() {
  const [activeTab, setActiveTab] = useState("upload");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [resultSource, setResultSource] = useState(null); // "upload" | "history"
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingLabel, setProcessingLabel] = useState(LABELS[0]);
  const [meetings, setMeetings] = useState([]);
  const [activeNav, setActiveNav] = useState("dashboard");

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [micError, setMicError] = useState("");
  const [recordingMode, setRecordingMode] = useState("system");
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  /* ── Progress ticker ──────────────────────────── */
  const startProgressTick = () => {
    let current = 0;
    const tick = setInterval(() => {
      current += Math.random() * 4;
      if (current > 90) current = 90;
      setProgress(Math.floor(current));
      const idx = Math.floor((current / 100) * LABELS.length);
      setProcessingLabel(LABELS[Math.min(idx, LABELS.length - 1)]);
    }, 450);
    return tick;
  };

  const finishLoading = (tick, data) => {
    clearInterval(tick);
    setProgress(100);
    setProcessingLabel("Complete!");
    setTimeout(() => {
      setResult(data);
      setResultSource("upload");
      fetchMeetings();
      setLoading(false);
    }, 800);
  };

  /* ── Upload file ──────────────────────────────── */
  const uploadFile = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setLoading(true); setProgress(0); setResult(null);
    const tick = startProgressTick();
    try {
      const res = await axios.post("http://127.0.0.1:8000/upload-audio/", formData);
      finishLoading(tick, res.data);
    } catch (err) {
      clearInterval(tick);
      console.error(err);
      alert("Error processing meeting. Is the backend running?");
      setLoading(false);
    }
  };

  /* ── Upload blob (after recording) ───────────── */
  const uploadAudioBlob = async (blob) => {
    const formData = new FormData();
    formData.append("file", blob, `recording-${Date.now()}.webm`);
    setLoading(true); setProgress(0); setResult(null);
    const tick = startProgressTick();
    try {
      const res = await axios.post("http://127.0.0.1:8000/upload-audio/", formData);
      finishLoading(tick, res.data);
    } catch (err) {
      clearInterval(tick);
      console.error(err);
      alert("Error processing meeting. Is the backend running?");
      setLoading(false);
    }
  };

  /* ── Start recording ──────────────────────────── */
  const startRecording = async () => {
    setMicError("");
    try {
      let stream;

      if (recordingMode === "mic") {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
        });
      } else {
        let systemStream;
        try {
          systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 16000 },
          });
          systemStream.getVideoTracks().forEach(t => t.stop());
        } catch (e) {
          setMicError(
            'Screen sharing was cancelled or system audio was not shared. ' +
            'Please click "Share" and make sure to check "Share system audio" (Chrome on Windows only).'
          );
          return;
        }

        const systemAudioTracks = systemStream.getAudioTracks();
        if (systemAudioTracks.length === 0) {
          systemStream.getTracks().forEach(t => t.stop());
          setMicError('No system audio was captured. Make sure to check "Share system audio" before clicking Share.');
          return;
        }

        let micStream;
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          micStream = null;
        }

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const destination = audioContext.createMediaStreamDestination();
        audioContext.createMediaStreamSource(systemStream).connect(destination);
        if (micStream) audioContext.createMediaStreamSource(micStream).connect(destination);
        stream = destination.stream;
        stream._cleanup = () => {
          systemStream.getTracks().forEach(t => t.stop());
          if (micStream) micStream.getTracks().forEach(t => t.stop());
          audioContext.close();
        };
      }

      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        uploadAudioBlob(blob);
        if (stream._cleanup) stream._cleanup();
        else stream.getTracks().forEach(t => t.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);

    } catch (err) {
      console.error("Recording error:", err);
      setMicError("Could not start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  /* ── Back to dashboard ────────────────────────── */
  const goBackToDashboard = () => {
    setResult(null);
    setResultSource(null);
    setFile(null);
    setRecordingTime(0);
    // If we came from history, go back to history; otherwise stay on dashboard
    if (resultSource === "history") {
      setActiveNav("history");
    }
  };

  /* ── Meetings ─────────────────────────────────── */
  const fetchMeetings = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/meetings");
      setMeetings(res.data);
    } catch (_) { }
  };

  const clearAllMeetings = async () => {
    if (!window.confirm(
      "This will permanently delete all meetings and their summaries from the database. This cannot be undone. Continue?"
    )) return;
    try {
      await axios.delete("http://127.0.0.1:8000/meetings");
      setMeetings([]);
      setResult(null);
    } catch (err) { alert("Failed to clear meetings."); }
  };

  useEffect(() => { fetchMeetings(); }, []);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const wc = result ? wordCount(result.transcript) : 0;
  const dur = result ? estimatedMinutes(result.transcript) : "0";
  const aiCount = result?.action_items?.length ?? 0;

  /* ── Shared results block ─────────────────────── */
  const ResultsView = () => (
    <>
      {/* Back button */}
      <div>
        <button
          className="btn btn-ghost back-btn"
          onClick={goBackToDashboard}
        >
          <ArrowLeft size={15} />
          {resultSource === "history" ? "Back to Past Meetings" : "New Analysis"}
        </button>
      </div>

      <div className="results-header">
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.15rem", fontWeight: 700 }}>
            {result.meeting_title || "Analysis Complete"}
          </h2>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {resultSource === "history"
              ? (result.created_at ? new Date(result.created_at).toLocaleString() : "Past meeting")
              : (file?.name ?? "Live Recording")}
          </p>
        </div>
        <div className="results-meta">
          <span className="meta-chip"><Clock size={13} /> {dur} min</span>
          <span className="meta-chip"><BarChart3 size={13} /> {wc} words</span>
          <span className="meta-chip"><CheckCircle2 size={13} /> {aiCount} actions</span>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Duration (est.)</div><div className="stat-value">{dur}<span className="stat-unit">min</span></div></div>
        <div className="stat-card"><div className="stat-label">Words Spoken</div><div className="stat-value">{wc.toLocaleString()}</div></div>
        <div className="stat-card"><div className="stat-label">Action Items</div><div className="stat-value" style={{ color: aiCount > 0 ? "var(--green)" : "inherit" }}>{aiCount}</div></div>
      </div>

      <div className="results-grid">
        <div className="card full">
          <div className="card-header"><div className="card-icon indigo"><Sparkles size={16} /></div><h3 className="card-title">Executive Summary</h3></div>
          <div className="summary-body">{renderMarkdown(result.summary)}</div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-icon green"><CheckCircle2 size={16} /></div><h3 className="card-title">Action Items</h3></div>
          {result.action_items && result.action_items.length > 0 ? (
            <ul className="action-list">
              {result.action_items.map((item, i) => (
                <li key={i} className="action-item">
                  <div className="action-bullet"><CheckCircle2 size={11} /></div>
                  <div className="action-body">
                    <div className="action-task">{item.task}</div>
                    <div className="action-meta">
                      {item.owner && <span><User size={11} /> {item.owner}</span>}
                      {item.deadline && <span><Calendar size={11} /> {item.deadline}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No clear action items were identified.</p>
          )}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-icon slate"><FileText size={16} /></div><h3 className="card-title">Full Transcript</h3></div>
          <div className="transcript-body">{result.transcript || "No transcript available."}</div>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-shell">

      {/* ── Top Nav ───────────────────────────────── */}
      <nav className="topnav">
        <div className="topnav-brand">
          <div className="brand-icon"><Mic size={16} color="#fff" strokeWidth={2.5} /></div>
          <span className="brand-name">Meeting Intelligence</span>
          <span className="brand-badge">AI</span>
        </div>
        <div className="topnav-actions">
          <div className="nav-status"><div className="status-dot" />Backend connected</div>
        </div>
      </nav>

      <div className="main-layout">

        {/* ── Sidebar ───────────────────────────────── */}
        <aside className="sidebar">
          <span className="sidebar-section-label">Workspace</span>
          {[
            { id: "dashboard", icon: <LayoutDashboard size={16} />, label: "Dashboard" },
            { id: "history",   icon: <History size={16} />,         label: "Past Meetings" },
          ].map((item) => (
            <div
              key={item.id}
              className={`sidebar-item ${activeNav === item.id && !result ? "active" : ""} ${result && item.id === "dashboard" ? "active" : ""}`}
              onClick={() => {
                setActiveNav(item.id);
                if (item.id === "dashboard") {
                  setResult(null);
                  setResultSource(null);
                  setFile(null);
                }
              }}
            >
              {item.icon}{item.label}
              {item.id === "history" && meetings.length > 0 && (
                <span style={{ marginLeft: "auto", background: "var(--brand-dim)", color: "var(--brand-hover)", fontSize: "0.72rem", fontWeight: 600, borderRadius: "99px", padding: "1px 7px", border: "1px solid rgba(99,102,241,0.2)" }}>
                  {meetings.length}
                </span>
              )}
            </div>
          ))}
        </aside>

        {/* ── Content ───────────────────────────────── */}
        <main className="content-area">

          {/* ── Results view (shared, shown over both tabs) ── */}
          {result && !loading && <ResultsView />}

          {/* ── Dashboard ─────────────────────────────── */}
          {activeNav === "dashboard" && !result && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Meeting Intelligence</h1>
                  <p className="page-subtitle">Upload an audio file or record live to extract insights, summaries & action items.</p>
                </div>
              </div>

              {/* Tab switcher */}
              {!loading && (
                <div className="tab-switcher">
                  <button className={`tab-btn ${activeTab === "upload" ? "active" : ""}`} onClick={() => { setActiveTab("upload"); setFile(null); setMicError(""); }}>
                    <Upload size={15} /> Upload Audio
                  </button>
                  <button className={`tab-btn ${activeTab === "record" ? "active" : ""}`} onClick={() => { setActiveTab("record"); setFile(null); setMicError(""); }}>
                    <Mic size={15} /> Record Live
                  </button>
                </div>
              )}

              {/* Processing */}
              {loading && (
                <div className="processing-card">
                  <div className="processing-spinner" />
                  <div className="processing-info">
                    <p className="processing-title">Analyzing Your Meeting</p>
                    <p className="processing-label">{processingLabel}</p>
                  </div>
                  <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                    <div className="progress-bar-wrap" style={{ width: "100%" }}>
                      <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="progress-pct">{progress}%</span>
                  </div>
                </div>
              )}

              {/* Upload tab */}
              {!loading && activeTab === "upload" && (
                <>
                  <div className={`upload-zone ${file ? "has-file" : ""}`}>
                    <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files[0])} />
                    <div className="upload-zone-icon"><FileAudio size={28} /></div>
                    <div>
                      <h2>Drop your audio file here</h2>
                      <p style={{ marginTop: 6 }}>or click anywhere in this area to browse</p>
                    </div>
                    <div className="upload-formats">
                      {["MP3", "WAV", "M4A", "OGG", "FLAC", "WEBM"].map((f) => (
                        <span className="format-tag" key={f}>{f}</span>
                      ))}
                    </div>
                    {file && (
                      <div className="file-selected" onClick={(e) => e.stopPropagation()}>
                        <FileAudio size={18} color="var(--brand)" />
                        <span className="file-selected-name">{file.name}</span>
                        <span className="file-selected-size">{formatBytes(file.size)}</span>
                        <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button className="btn btn-primary" onClick={uploadFile} disabled={!file} style={{ fontSize: "0.95rem", padding: "14px 32px" }}>
                      <Sparkles size={18} /> Analyze Meeting <ChevronRight size={18} />
                    </button>
                  </div>
                </>
              )}

              {/* Record tab */}
              {!loading && activeTab === "record" && (
                <div className="record-zone">
                  {!isRecording && (
                    <div className="record-mode-selector">
                      <p className="record-mode-label">What do you want to capture?</p>
                      <div className="record-mode-btns">
                        <button className={`record-mode-btn ${recordingMode === "system" ? "active" : ""}`} onClick={() => setRecordingMode("system")}>
                          <Monitor size={18} />
                          <span>All Participants</span>
                          <small>System audio + mic<br />(Chrome on Windows)</small>
                        </button>
                        <button className={`record-mode-btn ${recordingMode === "mic" ? "active" : ""}`} onClick={() => setRecordingMode("mic")}>
                          <Mic size={18} />
                          <span>My Voice Only</span>
                          <small>Microphone only<br />(all browsers)</small>
                        </button>
                      </div>
                      {recordingMode === "system" && (
                        <div className="record-hint">
                          <strong>How to capture all participants:</strong>
                          <ol>
                            <li>Click "Start Recording" below</li>
                            <li>In the browser dialog, select the tab/window with your meeting</li>
                            <li>Check <strong>"Share system audio"</strong> ✓</li>
                            <li>Click Share</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  )}

                  {micError && <p className="mic-error">{micError}</p>}

                  {!isRecording && (
                    <button className="btn btn-primary" style={{ fontSize: "0.95rem", padding: "14px 32px" }} onClick={startRecording}>
                      <Mic size={18} /> Start Recording
                    </button>
                  )}

                  {isRecording && (
                    <div className="recording-indicator">
                      <div className="red-dot" />
                      <span className="timer">{formatTime(recordingTime)}</span>
                      <button className="btn btn-primary" style={{ background: "#ef4444" }} onClick={stopRecording}>
                        Stop & Analyse
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── History ───────────────────────────────── */}
          {activeNav === "history" && !result && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Past Meetings</h1>
                  <p className="page-subtitle">{meetings.length} meeting{meetings.length !== 1 ? "s" : ""} analyzed.</p>
                </div>
                {meetings.length > 0 && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: "0.82rem", color: "var(--red)", borderColor: "rgba(239,68,68,0.3)" }}
                    onClick={clearAllMeetings}
                    title="Permanently deletes all meetings from the database"
                  >
                    <Trash2 size={14} /> Clear All
                  </button>
                )}
              </div>

              {meetings.length === 0 ? (
                <div style={{ color: "var(--text-subtle)", fontSize: "0.9rem", textAlign: "center", paddingTop: 60 }}>
                  No meetings analyzed yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {meetings.map((m, i) => (
                    <div key={m.id ?? i} className="card" style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
                      <div className="card-icon indigo" style={{ width: 40, height: 40, borderRadius: 10 }}><Mic size={18} /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>{m.title || `Meeting ${i + 1}`}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span>{m.created_at ? new Date(m.created_at).toLocaleString() : "—"}</span>
                          {m.transcript && <span>· {estimatedMinutes(m.transcript)} min · {wordCount(m.transcript).toLocaleString()} words</span>}
                          {m.action_items?.length > 0 && <span>· {m.action_items.length} action{m.action_items.length !== 1 ? "s" : ""}</span>}
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: "0.8rem" }}
                        onClick={() => {
                          setResult(m);
                          setResultSource("history");
                          setActiveNav("dashboard");
                        }}
                      >
                        View <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </main>
      </div>
    </div>
  );
}