import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Mic,
  Upload,
  FileAudio,
  LayoutDashboard,
  History,
  Settings,
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
} from "lucide-react";
import "./App.css";

/* ─── Helper ─────────────────────────────────────── */
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

/* ─── Clean raw LLM summary text ─────────────────── */
function cleanSummary(text) {
  if (!text) return "";
  const cutOff = text.search(/###\s*Action Items/i);
  if (cutOff !== -1) text = text.slice(0, cutOff);
  text = text.replace(/^\*?Meeting Title\*?:.*$/gim, "");
  text = text.replace(/^[=\-]{4,}$/gm, "");
  return text.trim();
}

/* ─── Markdown renderer (bold, italic, headings, lists) ── */
function renderMarkdown(rawText) {
  const text = cleanSummary(rawText);
  if (!text)
    return (
      <p className="summary-para" style={{ color: "var(--text-subtle)" }}>
        No summary generated.
      </p>
    );

  const lines = text.split("\n");
  const elements = [];
  let paraLines = [];

  const flushPara = (key) => {
    if (!paraLines.length) return;
    const joined = paraLines.join(" ").trim();
    if (joined)
      elements.push(
        <p key={key} className="summary-para">
          {inlineMarkdown(joined)}
        </p>
      );
    paraLines = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || /^[=\-]{3,}$/.test(trimmed)) {
      flushPara(`p${i}`);
      return;
    }
    if (/^#{1,3}\s/.test(trimmed)) {
      flushPara(`p${i}`);
      const heading = trimmed.replace(/^#{1,3}\s+/, "");
      elements.push(
        <p key={`h${i}`} className="summary-para">
          <strong style={{ color: "var(--text)", fontSize: "0.95rem" }}>
            {heading}
          </strong>
        </p>
      );
      return;
    }
    if (/^(\d+\.|[-*•])\s/.test(trimmed)) {
      flushPara(`p${i}`);
      const content = trimmed.replace(/^(\d+\.|[-*•])\s+/, "");
      elements.push(
        <p
          key={`li${i}`}
          className="summary-para"
          style={{ paddingLeft: "1.2em", position: "relative" }}
        >
          <span style={{ position: "absolute", left: 0, color: "var(--brand)" }}>
            ›
          </span>
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
  let last = 0,
    m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1])
      parts.push(
        <strong key={m.index}>
          <em>{m[1]}</em>
        </strong>
      );
    else if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ─── Processing labels ───────────────────────────── */
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
  const timerRef = useRef(null);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  /* ── Upload ───────────────────────────────────── */
  const uploadFile = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setProgress(0);
    setResult(null);

    let current = 0;
    const tick = setInterval(() => {
      current += Math.random() * 4;
      if (current > 90) current = 90;
      setProgress(Math.floor(current));
      const idx = Math.floor((current / 100) * LABELS.length);
      setProcessingLabel(LABELS[Math.min(idx, LABELS.length - 1)]);
    }, 450);

    try {
      const res = await axios.post(
        "http://127.0.0.1:8000/upload-audio/",
        formData
      );
      clearInterval(tick);
      setProgress(100);
      setProcessingLabel("Complete!");
      setTimeout(() => {
        setResult(res.data);
        fetchMeetings();
        setLoading(false);
      }, 800);
    } catch (err) {
      clearInterval(tick);
      console.error(err);
      alert("Error processing meeting. Is the backend running?");
      setLoading(false);
    }
  };

  /* ── Recording ────────────────────────────────── */
  const startRecording = async () => {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        uploadAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
      setMicError(
        "Microphone access was denied. Please allow microphone access in your browser settings."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const uploadAudioBlob = async (blob) => {
    const formData = new FormData();
    formData.append("file", blob, `recording-${Date.now()}.webm`);

    setLoading(true);
    setProgress(0);
    setResult(null);

    let current = 0;
    const tick = setInterval(() => {
      current += Math.random() * 4;
      if (current > 90) current = 90;
      setProgress(Math.floor(current));
      const idx = Math.floor((current / 100) * LABELS.length);
      setProcessingLabel(LABELS[Math.min(idx, LABELS.length - 1)]);
    }, 450);

    try {
      const res = await axios.post(
        "http://127.0.0.1:8000/upload-audio/",
        formData
      );
      clearInterval(tick);
      setProgress(100);
      setProcessingLabel("Complete!");
      setTimeout(() => {
        setResult(res.data);
        fetchMeetings();
        setLoading(false);
      }, 800);
    } catch (err) {
      clearInterval(tick);
      console.error(err);
      alert("Error processing meeting. Is the backend running?");
      setLoading(false);
    }
  };

  const resetRecording = () => {
    setResult(null);
    setRecordingTime(0);
  };

  /* ── Meetings API ─────────────────────────────── */
  const fetchMeetings = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/meetings");
      setMeetings(res.data);
    } catch (_) {}
  };

  const clearAllMeetings = async () => {
    if (!window.confirm("Clear all past meetings? This cannot be undone."))
      return;
    try {
      await axios.delete("http://127.0.0.1:8000/meetings");
      setMeetings([]);
    } catch (err) {
      console.error(err);
      alert("Failed to clear meetings.");
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* ── Derived ──────────────────────────────────── */
  const wc = result ? wordCount(result.transcript) : 0;
  const dur = result ? estimatedMinutes(result.transcript) : "0";
  const aiCount = result?.action_items?.length ?? 0;

  /* ── Render ───────────────────────────────────── */
  return (
    <div className="app-shell">

      {/* ── Top Nav ─────────────────────────────── */}
      <nav className="topnav">
        <div className="topnav-brand">
          <div className="brand-icon">
            <Mic size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <span className="brand-name">MeetingIQ</span>
          <span className="brand-badge">AI</span>
        </div>

        <div className="topnav-actions">
          <div className="nav-status">
            <div className="status-dot" />
            Backend connected
          </div>
        </div>
      </nav>

      {/* ── Body ────────────────────────────────── */}
      <div className="main-layout">

        {/* ── Sidebar ───────────────────────────── */}
        <aside className="sidebar">
          <span className="sidebar-section-label">Workspace</span>

          {[
            { id: "dashboard", icon: <LayoutDashboard size={16} />, label: "Dashboard" },
            { id: "history",   icon: <History size={16} />,         label: "Past Meetings" },
          ].map((item) => (
            <div
              key={item.id}
              className={`sidebar-item ${activeNav === item.id ? "active" : ""}`}
              onClick={() => setActiveNav(item.id)}
            >
              {item.icon}
              {item.label}
              {item.id === "history" && meetings.length > 0 && (
                <span style={{
                  marginLeft: "auto",
                  background: "var(--brand-dim)",
                  color: "var(--brand-hover)",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  borderRadius: "99px",
                  padding: "1px 7px",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}>
                  {meetings.length}
                </span>
              )}
            </div>
          ))}

          <div className="sidebar-bottom">
            <div className="sidebar-item" onClick={() => {}}>
              <Settings size={16} />
              Settings
            </div>
          </div>
        </aside>

        {/* ── Content ───────────────────────────── */}
        <main className="content-area">

          {/* ─ Dashboard Tab ───────────────────── */}
          {activeNav === "dashboard" && (
            <>
              {/* Page header */}
              <div className="page-header">
                <div>
                  <h1 className="page-title">Meeting Intelligence</h1>
                  <p className="page-subtitle">
                    Upload an audio file or record live to extract insights, summaries & action items.
                  </p>
                </div>
              </div>

              {/* ── Tab Switcher ─────────────────── */}
              {!result && !loading && (
                <div className="tab-switcher">
                  <button
                    className={`tab-btn ${activeTab === "upload" ? "active" : ""}`}
                    onClick={() => { setActiveTab("upload"); setFile(null); setMicError(""); }}
                  >
                    <Upload size={15} /> Upload Audio
                  </button>
                  <button
                    className={`tab-btn ${activeTab === "record" ? "active" : ""}`}
                    onClick={() => { setActiveTab("record"); setFile(null); setMicError(""); }}
                  >
                    <Mic size={15} /> Record Live
                  </button>
                </div>
              )}

              {/* ── Processing card ─────────────── */}
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

              {/* ── Upload Tab ──────────────────── */}
              {!result && !loading && activeTab === "upload" && (
                <>
                  <div className={`upload-zone ${file ? "has-file" : ""}`}>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => setFile(e.target.files[0])}
                    />
                    <div className="upload-zone-icon">
                      <FileAudio size={28} />
                    </div>
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
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      className="btn btn-primary"
                      onClick={uploadFile}
                      disabled={!file}
                      style={{ fontSize: "0.95rem", padding: "14px 32px" }}
                    >
                      <Sparkles size={18} />
                      Analyze Meeting
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </>
              )}

              {/* ── Record Tab ──────────────────── */}
              {!result && !loading && activeTab === "record" && (
                <div className="record-zone">
                  {micError && <p className="mic-error">{micError}</p>}

                  {!isRecording && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: "0.95rem", padding: "14px 32px" }}
                      onClick={startRecording}
                    >
                      <Mic size={18} /> Start Recording
                    </button>
                  )}

                  {isRecording && (
                    <div className="recording-indicator">
                      <div className="red-dot" />
                      <span className="timer">{formatTime(recordingTime)}</span>
                      <button
                        className="btn btn-primary"
                        style={{ background: "var(--red, #ef4444)", fontSize: "0.9rem", padding: "12px 24px" }}
                        onClick={stopRecording}
                      >
                        Stop & Analyse
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Results ─────────────────────── */}
              {result && !loading && (
                <>
                  {/* Header row */}
                  <div className="results-header">
                    <div>
                      <h2 style={{ margin: "0 0 4px", fontSize: "1.15rem", fontWeight: 700 }}>
                        {result.meeting_title || "Analysis Complete"}
                      </h2>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        {file?.name ?? "Live Recording"}
                      </p>
                    </div>
                    <div className="results-meta">
                      <span className="meta-chip"><Clock size={13} /> {dur} min</span>
                      <span className="meta-chip"><BarChart3 size={13} /> {wc} words</span>
                      <span className="meta-chip"><CheckCircle2 size={13} /> {aiCount} actions</span>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: "0.82rem" }}
                        onClick={() => {
                          setResult(null);
                          setFile(null);
                          resetRecording();
                        }}
                      >
                        <Upload size={14} /> New Analysis
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="stats-row">
                    <div className="stat-card">
                      <div className="stat-label">Duration (est.)</div>
                      <div className="stat-value">{dur}<span className="stat-unit">min</span></div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Words Spoken</div>
                      <div className="stat-value">{wc.toLocaleString()}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Action Items</div>
                      <div className="stat-value" style={{ color: aiCount > 0 ? "var(--green)" : "inherit" }}>
                        {aiCount}
                      </div>
                    </div>
                  </div>

                  {/* Bento grid */}
                  <div className="results-grid">

                    {/* Summary */}
                    <div className="card full">
                      <div className="card-header">
                        <div className="card-icon indigo"><Sparkles size={16} /></div>
                        <h3 className="card-title">Executive Summary</h3>
                      </div>
                      <div className="summary-body">
                        {renderMarkdown(result.summary)}
                      </div>
                    </div>

                    {/* Action Items */}
                    <div className="card">
                      <div className="card-header">
                        <div className="card-icon green"><CheckCircle2 size={16} /></div>
                        <h3 className="card-title">Action Items</h3>
                      </div>
                      {result.action_items && result.action_items.length > 0 ? (
                        <ul className="action-list">
                          {result.action_items.map((item, i) => (
                            <li key={i} className="action-item">
                              <div className="action-bullet">
                                <CheckCircle2 size={11} />
                              </div>
                              <div className="action-body">
                                <div className="action-task">{item.task}</div>
                                <div className="action-meta">
                                  {item.owner && (
                                    <span><User size={11} /> {item.owner}</span>
                                  )}
                                  {item.deadline && (
                                    <span><Calendar size={11} /> {item.deadline}</span>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="empty-state">No clear action items were identified.</p>
                      )}
                    </div>

                    {/* Transcript */}
                    <div className="card">
                      <div className="card-header">
                        <div className="card-icon slate"><FileText size={16} /></div>
                        <h3 className="card-title">Full Transcript</h3>
                      </div>
                      <div className="transcript-body">
                        {result.transcript || "No transcript available."}
                      </div>
                    </div>

                  </div>
                </>
              )}
            </>
          )}

          {/* ─ History Tab ─────────────────────── */}
          {activeNav === "history" && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Past Meetings</h1>
                  <p className="page-subtitle">
                    {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} analyzed.
                  </p>
                </div>
                {meetings.length > 0 && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: "0.82rem", color: "var(--red)", borderColor: "rgba(239,68,68,0.3)" }}
                    onClick={clearAllMeetings}
                  >
                    <Trash2 size={14} /> Clear All
                  </button>
                )}
              </div>

              {meetings.length === 0 ? (
                <div style={{ color: "var(--text-subtle)", fontSize: "0.9rem", textAlign: "center", paddingTop: 60 }}>
                  No meetings analyzed yet. Upload an audio file or record live to get started.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {meetings.map((m, i) => (
                    <div key={m.id ?? i} className="card" style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
                      <div className="card-icon indigo" style={{ width: 40, height: 40, borderRadius: 10 }}>
                        <Mic size={18} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>
                          {m.title || `Meeting ${i + 1}`}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span>{m.created_at ? new Date(m.created_at).toLocaleString() : "—"}</span>
                          {m.transcript && (
                            <span>· {estimatedMinutes(m.transcript)} min · {wordCount(m.transcript).toLocaleString()} words</span>
                          )}
                          {m.action_items?.length > 0 && (
                            <span>· {m.action_items.length} action{m.action_items.length !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: "0.8rem" }}
                        onClick={() => { setFile(null); setResult(m); setActiveNav("dashboard"); }}
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