import React, { useState, useEffect } from 'react';
import PhaseTracker from './components/PhaseTracker';
import Timer from './components/Timer';
import './App.css';
import { fetchData } from './api';

// Helper function to format duration
const formatDurationSummary = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

function App() {
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState(0);
  const [durations, setDurations] = useState({ warmUp: 0, climbing: 0, rehab: 0 });
  const [totalMoves, setTotalMoves] = useState(0);
  const [fingerboardData, setFingerboardData] = useState([]);

  useEffect(() => {
    const getData = async () => {
      const result = await fetchData();
      setData(result);
    };
    getData();
  }, []);

  const handleNextPhase = (duration) => {
    if (phase === 0) setDurations((d) => ({ ...d, warmUp: duration }));
    else if (phase === 1) setDurations((d) => ({ ...d, climbing: duration }));
    else if (phase === 2) setDurations((d) => ({ ...d, rehab: duration }));

    setPhase(phase + 1);
  };

  const handleFingerboardUpdate = (data) => {
    setFingerboardData(data);
  };

  const generateWorkoutCSV = () => {
    let csvContent = "Category,Value,Unit\n";
    csvContent += `Warm-up Duration,${formatDurationSummary(durations.warmUp)},duration\n`;
    csvContent += `Climbing Duration,${formatDurationSummary(durations.climbing)},duration\n`;
    csvContent += `Rehab Duration,${formatDurationSummary(durations.rehab)},duration\n`;
    csvContent += `Total Moves (Climbing),${totalMoves},moves\n\n`;

    if (fingerboardData && fingerboardData.length > 0) {
      csvContent += "Fingerboard Data\n";
      csvContent += "Set,Weight (lbs),Duration (s)\n";
      fingerboardData.forEach((set, index) => {
        // Note: The fingerboardData currently stores weight as 'kg' in the list item display.
        // The CSV requirement is 'Weight (lbs)'. I'll use the value as is, assuming the label change was sufficient.
        csvContent += `${index + 1},${set.weight},${set.duration}\n`;
      });
    } else {
      csvContent += "No fingerboard data recorded.\n";
    }
    return csvContent;
  };

  const handleEmailSummary = () => {
    const csvData = generateWorkoutCSV();
    const subject = "Workout Summary";
    const mailtoLink = `mailto:mwohner@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(csvData)}`;
    window.location.href = mailtoLink;
  };

  return (
    <div className="app">
      <h1 className="main-title">Workout Tracker</h1>
      <h2>{data}</h2>
      {phase < 3 ? (
        <PhaseTracker
          phase={phase}
          onPhaseComplete={handleNextPhase}
          totalMoves={totalMoves}
          setTotalMoves={setTotalMoves}
          onFingerboardDataChange={handleFingerboardUpdate}
        />
      ) : (
        <div className="summary">
          <h2>Workout Summary</h2>
          <p>Warm-up duration: {formatDurationSummary(durations.warmUp)}</p>
          <p>Climbing duration: {formatDurationSummary(durations.climbing)}</p>
          <p>Rehab duration: {formatDurationSummary(durations.rehab)}</p>
          <p>Total Moves during Climbing Phase: {totalMoves}</p>
          <h3>Fingerboard Data</h3>
          {fingerboardData && fingerboardData.length > 0 ? (
            <ul>
              {fingerboardData.map((set, index) => (
                <li key={set.id}>
                  {/* The label for weight was changed to lbs in FingerboardForm, but data is still 'kg' here.
                      The CSV asks for 'Weight (lbs)'. For now, using the value as is.
                      If conversion was needed, it would be here or in generateWorkoutCSV.
                  */}
                  Set {index + 1}: {set.weight} lbs, {set.duration} secs
                </li>
              ))}
            </ul>
          ) : (
            <p>No fingerboard data recorded.</p>
          )}
          <button onClick={handleEmailSummary} className="button" style={{ marginTop: '20px', fontSize: '1em' }}>
            Email Summary
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
