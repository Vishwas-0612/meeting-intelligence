import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";

function App() {

  const [activeTab, setActiveTab] = useState("upload");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [micError, setMicError] = useState("");
  const timerRef = useRef(null);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const uploadFile = async () => {

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await axios.post(
        "http://127.0.0.1:8000/upload-audio/",
        formData
      );

      setResult(res.data);
      fetchMeetings();
    } catch (err) {
      console.error(err);
      alert("Error processing meeting");
    }
    setLoading(false);
  };

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
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        uploadAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Mic access denied:", err);
      setMicError("Microphone access was denied. Please allow microphone access in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const uploadAudioBlob = async (blob) => {
    const formData = new FormData();
    formData.append("file", blob, `recording-${Date.now()}.webm`);

    try {
      setLoading(true);
      const res = await axios.post("http://127.0.0.1:8000/upload-audio/", formData);
      setResult(res.data);
      fetchMeetings();
    } catch (err) {
      console.error(err);
      alert("Error processing meeting");
    }
    setLoading(false);
  };

  const resetRecording = () => {
    setResult(null);
    setRecordingTime(0);
  };

  const fetchMeetings = async () => {
    try {
      const res = await axios.get(
        "http://127.0.0.1:8000/meetings"
      );
      setMeetings(res.data);
    } catch (err) {
      console.error(err);
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

  return (

    <div className="container">

      <h1>Meeting Intelligence Engine</h1>

      <div className="tab-switcher">
        <button 
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => { setActiveTab('upload'); setResult(null); }}
        >
          📁 Upload Audio
        </button>
        <button 
          className={`tab-btn ${activeTab === 'record' ? 'active' : ''}`}
          onClick={() => { setActiveTab('record'); setResult(null); }}
        >
          🎙️ Record Audio
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="upload-box">

          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <button onClick={uploadFile} disabled={loading}>
            {loading ? "Processing..." : "Upload"}
          </button>

        </div>
      )}

      {activeTab === 'record' && (
        <div className="upload-box" style={{ flexDirection: 'column' }}>
          {micError && <p className="mic-error">{micError}</p>}
          
          {!isRecording && !loading && !result && (
            <button onClick={startRecording}>Start Recording</button>
          )}

          {isRecording && (
            <div className="recording-indicator">
              <div className="red-dot"></div>
              <span className="timer">{formatTime(recordingTime)}</span>
              <button onClick={stopRecording}>Stop & Analyse</button>
            </div>
          )}

          {loading && (
            <div className="spinner-container">
              <div className="spinner"></div>
              <p>Transcribing & analysing…</p>
            </div>
          )}

          {result && !loading && (
             <button onClick={resetRecording}>Record Again</button>
          )}
        </div>
      )}


      {result && (

        <div className="results">

          {/* Meeting Insights */}
          <div className="card">

            <h2>Meeting Insights</h2>

            <p><strong>Estimated Duration:</strong> {result.transcript ? (result.transcript.split(" ").length / 150).toFixed(1) : "0"} minutes</p>

            <p><strong>Word Count:</strong> {result.transcript ? result.transcript.split(" ").length : 0}</p>

          </div>


          {/* Transcript */}
          <div className="card">

            <h2>Transcript</h2>

            <p className="transcript">
              {result.transcript}
            </p>

          </div>


          {/* Summary */}
          <div className="card">

            <h2>Summary</h2>

            <p>{result.summary}</p>

          </div>


          {/* Action Items */}
          <div className="card">

            <h2>Action Items</h2>

            {result.action_items && result.action_items.length > 0 ? (

              <ul>

                {result.action_items.map((item, i) => (

                  <li key={i}>

                    <strong>{item.task}</strong>
                    <br />
                    Owner: {item.owner || "N/A"}
                    <br />
                    Deadline: {item.deadline || "Not specified"}

                  </li>

                ))}

              </ul>

            ) : (

              <p>No tasks detected</p>

            )}

          </div>

        </div>

      )}


      {/* Meeting History */}

      <div className="history">

        <h2>Meeting History</h2>

        {meetings.length === 0 ? (

          <p>No meetings processed yet</p>

        ) : (

          <ul>

            {meetings.map((m) => (

              <li key={m.id}>

                <strong>{m.title}</strong>
                <br />
                {m.summary}

              </li>

            ))}

          </ul>

        )}

      </div>


    </div>

  );

}

export default App;