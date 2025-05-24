import React, { useState, useEffect } from 'react';
import PhaseTracker from './components/PhaseTracker';
import { formatTime } from './components/Timer'; // Correctly import formatTime
import './App.css';
import { fetchData } from './api';

// Helper function to format duration for summary - can be kept for specific summary formatting
const formatDurationSummary = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const WORKOUT_START_TIME_KEY = "workoutStartTime";

function App() {
  const [data, setData] = useState(null); // For API test data
  const [phase, setPhase] = useState(0);
  const [durations, setDurations] = useState({ warmUp: 0, climbing: 0, rehab: 0 });
  const [totalMoves, setTotalMoves] = useState(0);
  // Updated fingerboardData state to hold an object for hangboard sets and weighted pulls
  const [fingerboardData, setFingerboardData] = useState({ hangboardSets: [], weightedPulls: null });

  const [workoutStartTime, setWorkoutStartTime] = useState(null);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);
  const [lastPhaseEndTimeSeconds, setLastPhaseEndTimeSeconds] = useState(0);

  // Effect to load workoutStartTime from localStorage on mount
  useEffect(() => {
    const storedStartTime = localStorage.getItem(WORKOUT_START_TIME_KEY);
    if (storedStartTime) {
      setWorkoutStartTime(parseInt(storedStartTime, 10));
    }
  }, []);

  // Effect to manage the global timer interval
  useEffect(() => {
    let intervalId;
    if (workoutStartTime) {
      // Update elapsed time immediately when workoutStartTime is set or loaded
      setTotalElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));

      intervalId = setInterval(() => {
        setTotalElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(intervalId);
  }, [workoutStartTime]);

  useEffect(() => {
    const getData = async () => {
      const result = await fetchData();
      setData(result);
    };
    getData();
  }, []);

  const handleNextPhase = () => { // Removed duration parameter
    const currentPhaseDuration = totalElapsedTime - lastPhaseEndTimeSeconds;

    if (phase === 0) setDurations((d) => ({ ...d, warmUp: currentPhaseDuration }));
    else if (phase === 1) setDurations((d) => ({ ...d, climbing: currentPhaseDuration }));
    else if (phase === 2) setDurations((d) => ({ ...d, rehab: currentPhaseDuration }));
    
    setLastPhaseEndTimeSeconds(totalElapsedTime); // Update lastPhaseEndTimeSeconds
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
    // Add total workout time to CSV
    csvContent += `Total Workout Time,${formatTime(totalElapsedTime)},duration\n`;
    csvContent += `Total Moves (Climbing),${totalMoves},moves\n\n`;

    // Updated CSV generation for new fingerboardData structure
    if (fingerboardData && fingerboardData.hangboardSets && fingerboardData.hangboardSets.length > 0) {
      csvContent += "Hangboard Sets Data\n"; // Changed title for clarity
      csvContent += "Set,Weight (lbs),Duration (s)\n";
      fingerboardData.hangboardSets.forEach((set, index) => {
        csvContent += `${index + 1},${set.weight},${set.duration}\n`;
      });
    } else {
      csvContent += "No hangboard sets data recorded.\n";
    }

    csvContent += "\n"; // Add a blank line before weighted pulls data

    if (fingerboardData && fingerboardData.weightedPulls && (fingerboardData.weightedPulls.weight !== '' || fingerboardData.weightedPulls.reps !== '')) {
      csvContent += "Weighted Pulls Data\n";
      csvContent += `Weighted Pulls Weight,${fingerboardData.weightedPulls.weight !== '' ? fingerboardData.weightedPulls.weight : 'N/A'},lbs\n`;
      csvContent += `Weighted Pulls Reps,${fingerboardData.weightedPulls.reps !== '' ? fingerboardData.weightedPulls.reps : 'N/A'},reps\n`;
    } else {
      csvContent += "No weighted pulls data recorded.\n";
    }
    return csvContent;
  };

  const handleEmailSummary = () => {
    const csvData = generateWorkoutCSV();
    const subject = "Workout Summary";
    const mailtoLink = `mailto:mwohner@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(csvData)}`;
    window.location.href = mailtoLink;
  };

  const handleStartWorkout = () => {
    const now = Date.now();
    setWorkoutStartTime(now);
    localStorage.setItem(WORKOUT_START_TIME_KEY, now.toString());
  };

  // Removed the local formatGlobalTime function, as we now use the imported formatTime

  return (
    <div className="app">
      <h1 className="main-title">Workout Tracker</h1>
      <h2>{data}</h2> {/* API test data display */}

      {workoutStartTime === null ? (
        <div className="start-workout-container"> {/* Grouping button and message */}
          <button onClick={handleStartWorkout} className="button start-workout-button">
            Start Workout
          </button>
          <p className="start-prompt-message">Click "Start Workout" to begin tracking your session.</p>
        </div>
      ) : (
        <div className="global-timer-display">
          <p>Total Workout Time: {formatTime(totalElapsedTime)}</p> {/* Use imported formatTime */}
        </div>
      )}

      {/* Main content: PhaseTracker or Summary, only shown when workout has started */}
      {workoutStartTime !== null && (
        <>
          {phase < 3 ? (
            <PhaseTracker
              phase={phase}
              onPhaseComplete={handleNextPhase}
              totalMoves={totalMoves}
              setTotalMoves={setTotalMoves}
              onFingerboardDataChange={handleFingerboardUpdate}
              // workoutStartTime will be passed to PhaseTracker in a later step if needed
            />
          ) : (
            <div className="summary">
              <h2>Workout Summary</h2>
              <p>Warm-up duration: {formatDurationSummary(durations.warmUp)}</p>
              <p>Climbing duration: {formatDurationSummary(durations.climbing)}</p>
              <p>Rehab duration: {formatDurationSummary(durations.rehab)}</p>
              <p>Total Workout Time (summary): {formatTime(totalElapsedTime)}</p> {/* Use formatTime here too */}
              <p>Total Moves during Climbing Phase: {totalMoves}</p>
              
              {/* Display Hangboard Sets Data */}
              <h3>Hangboard Sets</h3>
              {fingerboardData && fingerboardData.hangboardSets && fingerboardData.hangboardSets.length > 0 ? (
                <ul>
                  {fingerboardData.hangboardSets.map((set) => ( // Removed index as set.id should be unique if available from form
                    <li key={set.id}> {/* Assuming set objects have a unique id */}
                      Set {set.id + 1}: {set.weight} lbs, {set.duration} secs
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No hangboard sets data recorded.</p>
              )}

              {/* Display Weighted Pulls Data */}
              <h3>Weighted Pulls</h3>
              {fingerboardData && fingerboardData.weightedPulls && (fingerboardData.weightedPulls.weight !== '' || fingerboardData.weightedPulls.reps !== '') ? (
                <p>
                  Weight Added: {fingerboardData.weightedPulls.weight !== '' ? `${fingerboardData.weightedPulls.weight} lbs` : 'N/A'}, 
                  Reps: {fingerboardData.weightedPulls.reps !== '' ? fingerboardData.weightedPulls.reps : 'N/A'}
                </p>
              ) : (
                <p>No weighted pulls data recorded.</p>
              )}

              <button onClick={handleEmailSummary} className="button" style={{ marginTop: '20px', fontSize: '1em' }}>
                Email Summary
              </button>
            </div>
          )}
        </>
      )}
      {/* The start-prompt-message is now part of the workoutStartTime === null block directly above */}
    </div>
  );
}

export default App;
