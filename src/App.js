import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Import Supabase client
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
  const [durations, setDurations] = useState({ stretching: 0, hangboard: 0, climbing: 0, rehab: 0 });
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
    setDurations({ stretching: 0, hangboard: 0, climbing: 0, rehab: 0 });
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

    if (storedPhase && parseInt(storedPhase, 10) === 4 && !storedStartTime) {
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

    if (workoutStartTime && phase < 4) {
      // Update elapsed time immediately when workoutStartTime is set or loaded,
      // and for subsequent updates as long as the phase is active.
      setTotalElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));

      intervalId = setInterval(() => {
        setTotalElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));
      }, 1000);
    }
    // The cleanup function will clear the interval when the component unmounts
    // or before the effect runs again (e.g., if workoutStartTime or phase changes).
    // This handles clearing the interval when phase becomes 4.
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
      setDurations((d) => ({ ...d, stretching: currentPhaseDuration }));
    } else if (currentPhaseValue === 1) {
      setDurations((d) => ({ ...d, hangboard: currentPhaseDuration }));
    } else if (currentPhaseValue === 2) {
      setDurations((d) => ({ ...d, climbing: currentPhaseDuration }));
    } else if (currentPhaseValue === 3) { // Transitioning to phase 4 (summary)
      setDurations((d) => ({ ...d, rehab: currentPhaseDuration }));
      localStorage.removeItem(WORKOUT_START_TIME_KEY); // Clear workout start time
    }
    
    setLastPhaseEndTimeSeconds(totalElapsedTime);

    const nextPhaseValue = currentPhaseValue + 1;
    // Resetting when *entering* Climbing Phase (which is now phase 2)
    if (nextPhaseValue === 2) { 
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
    csvContent += `Stretching Duration,${formatDurationSummary(durations.stretching)},duration\n`;
    csvContent += `Hangboard Duration,${formatDurationSummary(durations.hangboard)},duration\n`;
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
      csvContent += "Set,Weight (lbs),Duration (s),Edge Size\n";
      const filteredHangboardSets = fingerboardData.hangboardSets.filter(set => set.weight !== '' && Number(set.weight) >= 0);
      filteredHangboardSets.forEach((set, index) => {
        csvContent += `${index + 1},${set.weight},${set.duration},${set.edgeSize}\n`;
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

  const saveWorkoutData = async (userName) => {
    try {
      // 1. Fetch user_id from Supabase
      let { data: users, error: userError } = await supabase
        .from('users')
        .select('user_id')
        .eq('name', userName)
        .single();

      if (userError || !users) {
        console.error('Error fetching user or user not found:', userError);
        alert(`Error finding user ${userName}. Data not saved.`);
        return;
      }
      const userId = users.user_id;

      // 2. Prepare session data
      const sessionStartTime = new Date(workoutStartTime).toISOString();
      const sessionEndTime = new Date().toISOString(); // Current time as end time

      // 3. Insert into workout_sessions
      const { data: session, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert([
          { user_id: userId, start_time: sessionStartTime, end_time: sessionEndTime }
        ])
        .select()
        .single();

      if (sessionError || !session) {
        console.error('Error inserting workout session:', sessionError);
        alert('Error saving workout session. Data not fully saved.');
        return;
      }
      const sessionId = session.session_id;

      // 4. Prepare workout_data entries
      const dataToInsert = [];

      // Durations
      Object.entries(durations).forEach(([phaseName, duration]) => {
        if (duration > 0) { // Only save if duration is tracked
          dataToInsert.push({
            session_id: sessionId,
            category: phaseName, // 'stretching', 'hangboard', 'climbing', 'rehab'
            variable_name: 'duration',
            value: duration.toString(),
            unit: 'seconds'
          });
        }
      });

      // Total Moves (Climbing)
      if (totalMoves > 0) {
        dataToInsert.push({
          session_id: sessionId,
          category: 'climbing',
          variable_name: 'total_moves',
          value: totalMoves.toString(),
          unit: 'moves'
        });
      }

      // Climbing Stats
      Object.entries(climbingStats).forEach(([key, count]) => {
        const [grade, type] = key.split('_');
        dataToInsert.push({
          session_id: sessionId,
          category: 'climbing_stats',
          variable_name: `${grade}_${type}`,
          value: count.toString(),
          unit: 'count'
        });
      });

      // Fingerboard Data - Hangboard Sets
      if (fingerboardData && fingerboardData.hangboardSets) {
        const filteredHangboardSets = fingerboardData.hangboardSets.filter(set => set.weight !== '' && Number(set.weight) >= 0);
        filteredHangboardSets.forEach((set, index) => {
          // If a set is in filteredHangboardSets, its weight is valid. Save all its attributes.
          dataToInsert.push({ session_id: sessionId, category: 'hangboard_sets', variable_name: `set_${index + 1}_weight`, value: set.weight.toString(), unit: 'lbs' });
          dataToInsert.push({ session_id: sessionId, category: 'hangboard_sets', variable_name: `set_${index + 1}_duration`, value: set.duration.toString(), unit: 'seconds' });
          dataToInsert.push({ session_id: sessionId, category: 'hangboard_sets', variable_name: `set_${index + 1}_edge_size`, value: set.edgeSize, unit: 'mm' });
        });
      }

      // Fingerboard Data - Weighted Pulls
      if (fingerboardData && fingerboardData.weightedPulls) {
        if (fingerboardData.weightedPulls.weight !== '') {
          dataToInsert.push({ session_id: sessionId, category: 'hangboard_pulls', variable_name: 'weight', value: fingerboardData.weightedPulls.weight.toString(), unit: 'lbs' });
        }
        if (fingerboardData.weightedPulls.reps !== '') {
          dataToInsert.push({ session_id: sessionId, category: 'hangboard_pulls', variable_name: 'reps', value: fingerboardData.weightedPulls.reps.toString(), unit: 'reps' });
        }
      }
      
      // Add other specific data points if necessary (e.g. Rehab sets if tracked in App.js state)

      // 5. Insert into workout_data
      if (dataToInsert.length > 0) {
        const { error: dataError } = await supabase
          .from('workout_data')
          .insert(dataToInsert);

        if (dataError) {
          console.error('Error inserting workout data:', dataError);
          alert('Error saving detailed workout data.');
          return;
        }
      }

      alert(`Workout data saved for ${userName}!`);
      // Optionally, reset app state or navigate away after saving
      // resetAppStates(); 
      // setPhase(0); // Go to initial phase or a dedicated "thank you" screen

    } catch (error) {
      console.error('Unexpected error in saveWorkoutData:', error);
      alert('An unexpected error occurred while saving data.');
    }
  };

  return (
    <div className="app">
      <h1 className="main-title">Workout Tracker {workoutStartTime !== null ? formatTime(totalElapsedTime) : ""}</h1>
      <h2>{data}</h2> {/* API test data display */}

      {workoutStartTime === null ? (
        <div className="start-workout-container"> {/* Grouping button and message */}
          <button onClick={handleStartWorkout} className="button start-workout-button">
            Start Workout
          </button>
          <p className="start-prompt-message">Click "Start Workout" to begin tracking your session.</p>
        </div>
      ) : null}

      {/* Main content: PhaseTracker or Summary, only shown when workout has started */}
      {workoutStartTime !== null && (
        <>
          {phase < 4 ? (
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
              <p>Stretching duration: {formatDurationSummary(durations.stretching)}</p>
              <p>Hangboard duration: {formatDurationSummary(durations.hangboard)}</p>
              <p>Climbing duration: {formatDurationSummary(durations.climbing)}</p>
              <p>Rehab duration: {formatDurationSummary(durations.rehab)}</p>
              <p>Total Workout Time (summary): {formatTime(totalElapsedTime)}</p>
              <p>Total Moves during Climbing Phase: {totalMoves}</p>

              {/* ADD CONSOLE LOG HERE */}
              { phase === 4 && console.log("climbingStats before display:", climbingStats) }

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
                  {fingerboardData.hangboardSets
                    .filter(set => set.weight !== '' && Number(set.weight) >= 0)
                    .map((set, index) => ( // Added index for key and display consistency after filtering
                    <li key={set.id !== undefined ? set.id : index}> {/* Use set.id if available, otherwise index */}
                      Set {set.id !== undefined ? set.id + 1 : index + 1}: {set.weight} lbs, {set.duration} secs, Edge: {set.edgeSize}
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
              <div style={{ marginTop: '20px' }}>
                <button onClick={() => saveWorkoutData('Mike')} className="button" style={{ marginRight: '10px' }}>
                  Add-Mike
                </button>
                <button onClick={() => saveWorkoutData('Patti')} className="button">
                  Add-Patti
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* The start-prompt-message is now part of the workoutStartTime === null block directly above */}
    </div>
  );
}

export default App;
