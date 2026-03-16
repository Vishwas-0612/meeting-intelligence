import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {

  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);

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



  return (

    <div className="container">

      <h1>Meeting Intelligence Engine</h1>


      <div className="upload-box">

        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button onClick={uploadFile}>
          {loading ? "Processing..." : "Upload"}
        </button>

      </div>


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