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
const PHASE_KEY = "appPhase"; // Key for storing phase in localStorage

function App() {
  const [data, setData] = useState(null); // For API test data
  const [phase, setPhase] = useState(0);
  const [durations, setDurations] = useState({ warmUp: 0, climbing: 0, rehab: 0 });
  const [totalMoves, setTotalMoves] = useState(0);
  const [fingerboardData, setFingerboardData] = useState({ hangboardSets: [], weightedPulls: null });
  const [climbingStats, setClimbingStats] = useState({}); // New state for detailed climbing stats

  const [workoutStartTime, setWorkoutStartTime] = useState(null);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);
  const [lastPhaseEndTimeSeconds, setLastPhaseEndTimeSeconds] = useState(0);

  // Function to reset all relevant states to their initial values
  const resetAppStates = () => {
    setPhase(0);
    setWorkoutStartTime(null);
    setTotalElapsedTime(0);
    setDurations({ warmUp: 0, climbing: 0, rehab: 0 });
    setLastPhaseEndTimeSeconds(0);
    setTotalMoves(0);
    setFingerboardData({ hangboardSets: [], weightedPulls: null });
    setClimbingStats({}); // Reset climbing stats
    // Also clear them from localStorage for a clean start next time (optional, phase is handled by its own effect)
    localStorage.removeItem(WORKOUT_START_TIME_KEY);
    // localStorage.setItem(PHASE_KEY, "0"); // Phase will be set by its own effect
  };

  // Effect to load workout state from localStorage on mount
  useEffect(() => {
    const storedStartTime = localStorage.getItem(WORKOUT_START_TIME_KEY);
    const storedPhase = localStorage.getItem(PHASE_KEY);

    if (storedPhase && parseInt(storedPhase, 10) === 3 && !storedStartTime) {
      // If summary page was the last state and workout has ended (no start time)
      resetAppStates();
    } else if (storedStartTime) {
      setWorkoutStartTime(parseInt(storedStartTime, 10));
      if (storedPhase) { // If there's a start time, also restore phase
        setPhase(parseInt(storedPhase, 10));
      }
    }
    // If no storedStartTime, app starts in initial state (phase 0), which is default.
  }, []);

  // Effect to save phase to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(PHASE_KEY, phase.toString());
  }, [phase]);

  // Effect to manage the global timer interval
  useEffect(() => {
    let intervalId;

    if (workoutStartTime && phase < 3) {
      // Update elapsed time immediately when workoutStartTime is set or loaded,
      // and for subsequent updates as long as the phase is active.
      setTotalElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));

      intervalId = setInterval(() => {
        setTotalElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));
      }, 1000);
    }
    // The cleanup function will clear the interval when the component unmounts
    // or before the effect runs again (e.g., if workoutStartTime or phase changes).
    // This handles clearing the interval when phase becomes 3.
    return () => {
      clearInterval(intervalId);
    };
  }, [workoutStartTime, phase]); // Add phase to dependency array

  useEffect(() => {
    const getData = async () => {
      const result = await fetchData();
      setData(result);
    };
    getData();
  }, []);

  const handleNextPhase = () => {
    const currentPhaseDuration = totalElapsedTime - lastPhaseEndTimeSeconds;
    const currentPhaseValue = phase; // Capture current phase value before updating state

    if (currentPhaseValue === 0) {
      setDurations((d) => ({ ...d, warmUp: currentPhaseDuration }));
    } else if (currentPhaseValue === 1) {
      setDurations((d) => ({ ...d, climbing: currentPhaseDuration }));
    } else if (currentPhaseValue === 2) { // Transitioning to phase 3 (summary)
      setDurations((d) => ({ ...d, rehab: currentPhaseDuration }));
      localStorage.removeItem(WORKOUT_START_TIME_KEY); // Clear workout start time
    }
    
    setLastPhaseEndTimeSeconds(totalElapsedTime);

    const nextPhaseValue = currentPhaseValue + 1;
    if (nextPhaseValue === 1) { // Resetting when *entering* Climbing Phase (from Warm-up)
      setTotalMoves(0);
      setClimbingStats({}); 
    }
    setPhase(nextPhaseValue);
  };

  const handleClimbingStatUpdate = (grade, type, increment) => {
    const key = `${grade}_${type}`;
    setClimbingStats(prevStats => ({
      ...prevStats,
      [key]: (prevStats[key] || 0) + increment
    }));
    // Ensure totalMoves is updated only by "attempts" to avoid double counting if sends/flashes also count as moves.
    // Or, if sends/flashes are separate actions that constitute a move, then this is fine.
    // For now, let's assume any recorded stat action (attempt, send, flash) counts towards totalMoves.
    // If a "send" also implies an "attempt", this might lead to double counting totalMoves if not handled carefully in UI/logic.
    // The current PhaseTracker calls updateTotalMoves for each counter type, so this behavior is maintained.
    setTotalMoves(prevTotalMoves => prevTotalMoves + increment);
  };

  const handleFingerboardUpdate = (data) => {
    setFingerboardData(data);
  };

  const generateWorkoutCSV = () => {
    let csvContent = "Category,Value,Unit\n";
    csvContent += `Warm-up Duration,${formatDurationSummary(durations.warmUp)},duration\n`;
    csvContent += `Climbing Duration,${formatDurationSummary(durations.climbing)},duration\n`;
    csvContent += `Rehab Duration,${formatDurationSummary(durations.rehab)},duration\n`;
    csvContent += `Total Workout Time,${formatTime(totalElapsedTime)},duration\n`;
    csvContent += `Total Moves (Climbing),${totalMoves},moves\n`; // Overall total moves

    // Detailed climbing stats
    csvContent += "\nClimbing Details\nGrade,Type,Count\n";
    Object.entries(climbingStats).forEach(([key, count]) => {
      const [grade, type] = key.split('_');
      csvContent += `${grade},${type},${count}\n`;
    });
    csvContent += "\n";
    
    // Fingerboard data
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
    // Reset states before starting a new workout, ensuring phase is 0
    resetAppStates(); // This will set phase to 0 and clear old data.
    // Then, set the new workout start time.
    setWorkoutStartTime(now);
    localStorage.setItem(WORKOUT_START_TIME_KEY, now.toString());
    // Phase is already set to 0 by resetAppStates, and its effect will store it.
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
              phase={phase} // Only one phase prop needed
              totalMoves={totalMoves} // Pass totalMoves for display in PhaseTracker header
              onPhaseComplete={handleNextPhase}
              onFingerboardDataChange={handleFingerboardUpdate}
              handleClimbingStatUpdate={handleClimbingStatUpdate}
            />
          ) : (
            <div className="summary">
              <h2>Workout Summary</h2>
              <p>Warm-up duration: {formatDurationSummary(durations.warmUp)}</p>
              <p>Climbing duration: {formatDurationSummary(durations.climbing)}</p>
              <p>Rehab duration: {formatDurationSummary(durations.rehab)}</p>
              <p>Total Workout Time (summary): {formatTime(totalElapsedTime)}</p>
              <p>Total Moves during Climbing Phase: {totalMoves}</p>

              {/* ADD CONSOLE LOG HERE */}
              { phase === 3 && console.log("climbingStats before display:", climbingStats) }

              {/* Display Detailed Climbing Stats */}
              <h3>Climbing Details</h3>
              {Object.keys(climbingStats).length > 0 ? (
                <ul>
                  {Object.entries(climbingStats).map(([key, count]) => {
                    const [grade, type] = key.split('_');
                    return <li key={key}>{`${grade} - ${type}: ${count}`}</li>;
                  })}
                </ul>
              ) : (
                <p>No climbing details recorded.</p>
              )}
              
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
