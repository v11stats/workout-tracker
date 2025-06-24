import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Import Supabase client
import PhaseTracker from './components/PhaseTracker';
import EditableSummaryField from './components/EditableSummaryField'; // Import new component
import { formatTime } from './components/Timer'; // Correctly import formatTime
import './App.css';
import { fetchData } from './api';

// Helper function to format duration for summary - can be kept for specific summary formatting
const formatDurationSummary = (totalSeconds) => {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) return '0m 0s';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

// Helper function to parse "Xm Ys" string to seconds
const parseDurationSummary = (durationString) => {
  if (typeof durationString !== 'string') return 0;
  const parts = durationString.match(/(\d+)m\s*(\d+)s/);
  if (parts && parts.length === 3) {
    return parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  }
  // Handle cases like "Xm" or "Ys" or just numbers (assume seconds)
  const minutesMatch = durationString.match(/(\d+)m/);
  const secondsMatch = durationString.match(/(\d+)s/);
  let totalSeconds = 0;
  if (minutesMatch) totalSeconds += parseInt(minutesMatch[1], 10) * 60;
  if (secondsMatch) {
     // If "s" is present but no "m", check if the number before "s" is the only one.
     // e.g. "30s"
     const sOnly = durationString.match(/^(\d+)s$/);
     if (sOnly) totalSeconds += parseInt(sOnly[1], 10);
     // If like "5m 30s", parts[2] would be used above. This handles "30s" if "m" is not there.
     else if (!minutesMatch) totalSeconds += parseInt(secondsMatch[1], 10);
  }
  if (!minutesMatch && !secondsMatch && /^\d+$/.test(durationString)) {
    totalSeconds = parseInt(durationString, 10); // Assume seconds if just a number
  }
  return totalSeconds;
};

// Helper function to parse "H:MM" string to seconds
const parseTotalTimeSummary = (timeString) => {
  if (typeof timeString !== 'string') return 0;
  const parts = timeString.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60;
  }
  if (parts.length === 1 && /^\d+$/.test(parts[0])) {
    return parseInt(parts[0], 10) * 60; // Assume minutes if only one number
  }
  return 0;
};


const WORKOUT_START_TIME_KEY = "workoutStartTime";
const PHASE_KEY = "appPhase"; // Key for storing phase in localStorage

function App() {
  const [data, setData] = useState(null); // For API test data
  const [phase, setPhase] = useState(0);
  const [durations, setDurations] = useState({ stretching: 0, hangboard: 0, climbing: 0, power_endurance: 0, rehab: 0 });
  const [totalMoves, setTotalMoves] = useState(0);
  const [fingerboardData, setFingerboardData] = useState({ hangboardSets: [], weightedPulls: [] });
  const [climbingStats, setClimbingStats] = useState({}); // New state for detailed climbing stats
  const [powerEnduranceSetsData, setPowerEnduranceSetsData] = useState(
    Array.from({ length: 3 }, () => ({ grade: '' }))
  );

  // State for editable summary data
  const [editableData, setEditableData] = useState(null);


  const [workoutStartTime, setWorkoutStartTime] = useState(null);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);
  const [lastPhaseEndTimeSeconds, setLastPhaseEndTimeSeconds] = useState(0);
  const [currentPhaseElapsedTime, setCurrentPhaseElapsedTime] = useState(0);

  const formatTotalTime = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) return '0:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const paddedMins = minutes.toString().padStart(2, '0');
    return `${hours}:${paddedMins}`;
  };

  // Function to reset all relevant states to their initial values
  const resetAppStates = () => {
    setPhase(0);
    setWorkoutStartTime(null);
    setTotalElapsedTime(0);
    setCurrentPhaseElapsedTime(0); // Reset current phase time
    setDurations({ stretching: 0, hangboard: 0, climbing: 0, power_endurance: 0, rehab: 0 });
    setLastPhaseEndTimeSeconds(0);
    setTotalMoves(0);
    setFingerboardData({ hangboardSets: [], weightedPulls: [] });
    setClimbingStats({}); // Reset climbing stats
    setPowerEnduranceSetsData(Array.from({ length: 3 }, () => ({ grade: '' }))); // Reset power endurance data
    setEditableData(null); // Reset editable data
    // Also clear them from localStorage for a clean start next time (optional, phase is handled by its own effect)
    localStorage.removeItem(WORKOUT_START_TIME_KEY);
    // localStorage.setItem(PHASE_KEY, "0"); // Phase will be set by its own effect
  };

  // Effect to load workout state from localStorage on mount
  useEffect(() => {
    const storedStartTime = localStorage.getItem(WORKOUT_START_TIME_KEY);
    const storedPhase = localStorage.getItem(PHASE_KEY);

    if (storedPhase && parseInt(storedPhase, 10) === 5 && !storedStartTime) {
      resetAppStates();
    } else if (storedStartTime) {
      setWorkoutStartTime(parseInt(storedStartTime, 10));
      if (storedPhase) {
        const currentPhase = parseInt(storedPhase, 10);
        setPhase(currentPhase);
        // Initialize editableData if starting on summary page or if data might have been missed
        // This depends on durations, climbingStats etc. being available from their own state initializations
        // or loaded if the app was closed and reopened in phase 5.
        if (currentPhase === 5) {
          initializeEditableData();
        }
      }
    }
  }, []); // Empty dependency array means this runs once on mount


  // Effect to save phase to localStorage whenever it changes
  // Also, initialize editableData when entering phase 5
  useEffect(() => {
    localStorage.setItem(PHASE_KEY, phase.toString());
    if (phase === 5) {
      initializeEditableData();
    } else {
      // Clear editable data if not in summary phase to ensure fresh data next time
      setEditableData(null);
    }
  }, [phase, durations, totalMoves, climbingStats, fingerboardData, powerEnduranceSetsData, totalElapsedTime]); // Ensure this re-runs if these change AND phase becomes 5


  // Effect to manage the global timer interval
  useEffect(() => {
    let intervalId;

    if (workoutStartTime && phase < 5) { // Adjusted for new summary phase 5
      // Update elapsed time immediately when workoutStartTime is set or loaded,
      // and for subsequent updates as long as the phase is active.
      const updateTotalAndPhaseTimes = () => {
        const nowSeconds = Math.floor((Date.now() - workoutStartTime) / 1000);
        setTotalElapsedTime(nowSeconds);
        setCurrentPhaseElapsedTime(nowSeconds - lastPhaseEndTimeSeconds);
      };
      updateTotalAndPhaseTimes(); // Initial call to set times immediately

      intervalId = setInterval(updateTotalAndPhaseTimes, 1000);
    }
    // The cleanup function will clear the interval when the component unmounts
    // or before the effect runs again (e.g., if workoutStartTime or phase changes).
    // This handles clearing the interval when phase becomes 4.
    return () => {
      clearInterval(intervalId);
    };
  }, [workoutStartTime, phase, lastPhaseEndTimeSeconds]); // lastPhaseEndTimeSeconds added to ensure timer updates correctly after phase change

  useEffect(() => {
    const getData = async () => {
      const result = await fetchData();
      setData(result);
    };
    getData();
  }, []);

  const initializeEditableData = () => {
    // Initialize editableData with current values from state
    // This ensures that when the user first sees the summary, it reflects the tracked data.
    // FingerboardData needs careful handling due to its array structure.
    // Ensure all parts of fingerboardData are deeply copied if they are objects/arrays.
    setEditableData({
      durations: { ...durations },
      totalElapsedTime,
      totalMoves,
      climbingStats: { ...climbingStats },
      fingerboardData: {
        hangboardSets: fingerboardData.hangboardSets.map(set => ({ ...set })),
        weightedPulls: fingerboardData.weightedPulls.map(set => ({ ...set })),
      },
      powerEnduranceSetsData: powerEnduranceSetsData.map(set => ({ ...set })),
    });
  };


  const handleNextPhase = () => {
    const currentPhaseDuration = totalElapsedTime - lastPhaseEndTimeSeconds;
    const currentPhaseValue = phase;

    if (currentPhaseValue === 0) {
      setDurations((d) => ({ ...d, stretching: currentPhaseDuration }));
    } else if (currentPhaseValue === 1) {
      setDurations((d) => ({ ...d, hangboard: currentPhaseDuration }));
    } else if (currentPhaseValue === 2) {
      setDurations((d) => ({ ...d, climbing: currentPhaseDuration }));
    } else if (currentPhaseValue === 3) {
      setDurations((d) => ({ ...d, power_endurance: currentPhaseDuration }));
    } else if (currentPhaseValue === 4) {
      setDurations((d) => ({ ...d, rehab: currentPhaseDuration }));
      localStorage.removeItem(WORKOUT_START_TIME_KEY);
    }
    
    setLastPhaseEndTimeSeconds(totalElapsedTime);
    setCurrentPhaseElapsedTime(0);

    const nextPhaseValue = currentPhaseValue + 1;
    if (nextPhaseValue === 2) { 
      setTotalMoves(0);
      setClimbingStats({}); 
    }
    setPhase(nextPhaseValue);
  };

  // Generic handler for simple editable fields (durations, totalElapsedTime, totalMoves)
  const handleEditableFieldChange = (field, value, type) => {
    setEditableData(prev => {
      if (!prev) return null; // Should not happen if initialized correctly
      let processedValue = value;
      if (type === 'timeString') {
        processedValue = parseDurationSummary(value);
      } else if (type === 'totalTimeString') {
        processedValue = parseTotalTimeSummary(value);
      } else if (type === 'number') {
        processedValue = value === '' ? 0 : Number(value);
        if (isNaN(processedValue)) { // Revert to previous valid state if input is not a number
            if (['stretching', 'hangboard', 'climbing', 'power_endurance', 'rehab'].includes(field)) {
                 processedValue = prev.durations[field] || 0;
            } else {
                 processedValue = prev[field] || 0;
            }
        }
      }

      if (['stretching', 'hangboard', 'climbing', 'power_endurance', 'rehab'].includes(field)) {
        return {
          ...prev,
          durations: {
            ...prev.durations,
            [field]: processedValue
          }
        };
      }
      return { ...prev, [field]: processedValue };
    });
  };

  const handleEditableClimbingStatChange = (key, newValue) => {
    const numericValue = newValue === '' ? 0 : Number(newValue);
    if (isNaN(numericValue)) return;

    setEditableData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        climbingStats: {
          ...prev.climbingStats,
          [key]: numericValue
        }
      };
    });
  };

  const handleEditableHangboardSetChange = (index, field, newValue) => {
    // For numeric fields, validate and convert
    let processedValue = newValue;
    if (field === 'weight' || field === 'duration' || field === 'edgeSize') {
        processedValue = newValue === '' ? '' : String(newValue); // Keep as string for input, allow empty
        if (newValue !== '' && isNaN(Number(newValue))) return; // Basic validation
    }

    setEditableData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        fingerboardData: {
          ...prev.fingerboardData,
          hangboardSets: prev.fingerboardData.hangboardSets.map((set, i) =>
            i === index ? { ...set, [field]: processedValue } : set
          )
        }
      };
    });
  };

  const handleEditableWeightedPullSetChange = (index, field, newValue) => {
    let processedValue = newValue;
    if (field === 'weight' || field === 'reps') {
        processedValue = newValue === '' ? '' : String(newValue);
        if (newValue !== '' && isNaN(Number(newValue))) return;
    }
    setEditableData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        fingerboardData: {
          ...prev.fingerboardData,
          weightedPulls: prev.fingerboardData.weightedPulls.map((set, i) =>
            i === index ? { ...set, [field]: processedValue } : set
          )
        }
      };
    });
  };

  const handleEditablePowerEnduranceSetChange = (index, field, newValue) => {
    setEditableData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        powerEnduranceSetsData: prev.powerEnduranceSetsData.map((set, i) =>
          i === index ? { ...set, [field]: newValue } : set // Grade is text
        )
      };
    });
  };


  const handleClimbingStatUpdate = (grade, type, increment) => {
    const key = `${grade}_${type}`;
    setClimbingStats(prevStats => ({
      ...prevStats,
      [key]: (prevStats[key] || 0) + increment
    }));
    setTotalMoves(prevTotalMoves => prevTotalMoves + increment);
  };

  const handleFingerboardUpdate = (newData) => { // Renamed data to newData for clarity
    setFingerboardData(newData);
  };

  const handlePowerEnduranceUpdate = (index, grade) => {
    setPowerEnduranceSetsData(prevData =>
      prevData.map((set, i) => (i === index ? { ...set, grade: grade } : set))
    );
  };

  const generateWorkoutCSV = () => {
    const source = editableData || { durations, totalElapsedTime, totalMoves, climbingStats, fingerboardData, powerEnduranceSetsData };

    let csvContent = "Category,Value,Unit\n";
    csvContent += `Stretching Duration,${formatDurationSummary(source.durations.stretching)},duration\n`;
    csvContent += `Hangboard Duration,${formatDurationSummary(source.durations.hangboard)},duration\n`;
    csvContent += `Climbing Duration,${formatDurationSummary(source.durations.climbing)},duration\n`;
    csvContent += `Power Endurance Duration,${formatDurationSummary(source.durations.power_endurance)},duration\n`;
    csvContent += `Rehab Duration,${formatDurationSummary(source.durations.rehab)},duration\n`;
    csvContent += `Total Workout Time,${formatTime(source.totalElapsedTime)},duration\n`;
    csvContent += `Total Moves (Climbing),${source.totalMoves},moves\n`;

    csvContent += "\nClimbing Details\nGrade,Type,Count\n";
    Object.entries(source.climbingStats).forEach(([key, count]) => {
      const [grade, type] = key.split('_');
      csvContent += `${grade},${type},${count}\n`;
    });
    csvContent += "\n";
    
    if (source.fingerboardData && source.fingerboardData.hangboardSets && source.fingerboardData.hangboardSets.length > 0) {
      csvContent += "Hangboard Sets Data\n";
      csvContent += "Set,Weight (lbs),Duration (s),Edge Size\n";
      const filteredHangboardSets = source.fingerboardData.hangboardSets.filter(set => set.weight !== '' && String(set.weight).trim() !== '' && !isNaN(Number(set.weight)) && Number(set.weight) >= 0);
      filteredHangboardSets.forEach((set, index) => {
        csvContent += `${index + 1},${set.weight},${set.duration},${set.edgeSize}\n`;
      });
    } else {
      csvContent += "No hangboard sets data recorded.\n";
    }

    csvContent += "\n";

    if (source.fingerboardData && source.fingerboardData.weightedPulls && source.fingerboardData.weightedPulls.length > 0 && source.fingerboardData.weightedPulls.some(set => (set.weight !== '' && String(set.weight).trim() !== '' && !isNaN(Number(set.weight))) || (set.reps !== '' && String(set.reps).trim() !== '' && !isNaN(Number(set.reps))))) {
      csvContent += "Weighted Pulls Sets Data\n";
      csvContent += "Set,Type,Value,Unit\n";
      source.fingerboardData.weightedPulls.forEach((set, index) => {
        const hasWeight = set.weight !== '' && String(set.weight).trim() !== '' && !isNaN(Number(set.weight));
        const hasReps = set.reps !== '' && String(set.reps).trim() !== '' && !isNaN(Number(set.reps));
        if (hasWeight || hasReps) {
          if (hasWeight) csvContent += `Set ${index + 1},Weight,${set.weight},lbs\n`;
          if (hasReps) csvContent += `Set ${index + 1},Reps,${set.reps},reps\n`;
        }
      });
    } else {
      csvContent += "No weighted pulls data recorded.\n";
    }

    csvContent += "\n";

    if (source.powerEnduranceSetsData && source.powerEnduranceSetsData.some(set => set.grade !== '' && String(set.grade).trim() !== '')) {
      csvContent += "Power Endurance Climbs Data\n";
      csvContent += "Set,Grade\n";
      source.powerEnduranceSetsData.forEach((set, index) => {
        if (set.grade !== '' && String(set.grade).trim() !== '') {
          csvContent += `Set ${index + 1},${set.grade}\n`;
        }
      });
    } else {
      csvContent += "No power endurance data recorded.\n";
    }
    return csvContent;
  };

  const handleEmailSummary = () => {
    const csvData = generateWorkoutCSV(); // generateWorkoutCSV now uses editableData if available
    const subject = "Workout Summary";
    const mailtoLink = `mailto:mwohner@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(csvData)}`;
    window.location.href = mailtoLink;
  };

  const handleStartWorkout = () => {
    const now = Date.now();
    resetAppStates();
    setWorkoutStartTime(now);
    setLastPhaseEndTimeSeconds(0);
    setCurrentPhaseElapsedTime(0);
    localStorage.setItem(WORKOUT_START_TIME_KEY, now.toString());
  };

  const saveWorkoutData = async (userName) => {
    const sourceData = editableData || {
      durations,
      totalElapsedTime,
      totalMoves,
      climbingStats,
      fingerboardData,
      powerEnduranceSetsData,
    };

    const sessionStartTimeToSave = workoutStartTime
      ? new Date(workoutStartTime).toISOString()
      : new Date().toISOString();

    try {
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

      const sessionEndTime = new Date().toISOString();

      const { data: session, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert([
          { user_id: userId, start_time: sessionStartTimeToSave, end_time: sessionEndTime }
        ])
        .select()
        .single();

      if (sessionError || !session) {
        console.error('Error inserting workout session:', sessionError);
        alert('Error saving workout session. Data not fully saved.');
        return;
      }
      const sessionId = session.session_id;

      const dataToInsert = [];

      Object.entries(sourceData.durations).forEach(([phaseName, durationInSeconds]) => {
        if (durationInSeconds > 0) {
          dataToInsert.push({
            session_id: sessionId,
            category: phaseName,
            variable_name: 'duration',
            value: String(durationInSeconds),
            unit: 'seconds'
          });
        }
      });

      if (sourceData.totalElapsedTime > 0) {
          dataToInsert.push({
              session_id: sessionId,
              category: 'overall_summary',
              variable_name: 'total_workout_time', // Storing the (potentially edited) total time
              value: String(sourceData.totalElapsedTime),
              unit: 'seconds'
          });
      }

      if (sourceData.totalMoves > 0) {
        dataToInsert.push({
          session_id: sessionId,
          category: 'climbing',
          variable_name: 'total_moves',
          value: String(sourceData.totalMoves),
          unit: 'moves'
        });
      }

      Object.entries(sourceData.climbingStats).forEach(([key, count]) => {
        const [grade, type] = key.split('_');
        dataToInsert.push({
          session_id: sessionId,
          category: 'climbing_stats',
          variable_name: `${grade}_${type}`,
          value: String(count),
          unit: 'count'
        });
      });

      if (sourceData.fingerboardData && sourceData.fingerboardData.hangboardSets) {
        const filteredHangboardSets = sourceData.fingerboardData.hangboardSets.filter(set => set.weight !== '' && String(set.weight).trim() !== '' && !isNaN(Number(set.weight)) && Number(set.weight) >= 0);
        filteredHangboardSets.forEach((set, index) => {
          dataToInsert.push({ session_id: sessionId, category: 'hangboard_sets', variable_name: `set_${index + 1}_weight`, value: String(set.weight), unit: 'lbs' });
          dataToInsert.push({ session_id: sessionId, category: 'hangboard_sets', variable_name: `set_${index + 1}_duration`, value: String(set.duration), unit: 'seconds' });
          dataToInsert.push({ session_id: sessionId, category: 'hangboard_sets', variable_name: `set_${index + 1}_edge_size`, value: String(set.edgeSize), unit: 'mm' });
        });
      }

      if (sourceData.fingerboardData && sourceData.fingerboardData.weightedPulls && sourceData.fingerboardData.weightedPulls.length > 0) {
        sourceData.fingerboardData.weightedPulls.forEach((set, index) => {
          const hasWeight = set.weight !== '' && String(set.weight).trim() !== '' && !isNaN(Number(set.weight));
          const hasReps = set.reps !== '' && String(set.reps).trim() !== '' && !isNaN(Number(set.reps));
          if (hasWeight || hasReps) {
            if (hasWeight) dataToInsert.push({ session_id: sessionId, category: 'weighted_pulls_sets', variable_name: `set_${index + 1}_weight`, value: String(set.weight), unit: 'lbs' });
            if (hasReps) dataToInsert.push({ session_id: sessionId, category: 'weighted_pulls_sets', variable_name: `set_${index + 1}_reps`, value: String(set.reps), unit: 'reps' });
          }
        });
      }

      sourceData.powerEnduranceSetsData.forEach((set, index) => {
        if (set.grade !== '' && String(set.grade).trim() !== '') {
          dataToInsert.push({
            session_id: sessionId,
            category: 'power_endurance_sets',
            variable_name: `set_${index + 1}_grade`,
            value: set.grade, // Grade is already a string
            unit: 'grade' 
          });
        }
      });
      
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
      // resetAppStates(); 
      // setPhase(0);

    } catch (error) {
      console.error('Unexpected error in saveWorkoutData:', error);
      alert('An unexpected error occurred while saving data.');
    }
  };

  // Determine the data source for rendering: editableData if in summary and initialized, otherwise original state.
  const currentDisplayData = phase === 5 && editableData
    ? editableData
    : { durations, totalElapsedTime, totalMoves, climbingStats, fingerboardData, powerEnduranceSetsData };


  return (
    <div className="app">
      <h1 className="main-title">
        {workoutStartTime !== null 
          ? `${formatTotalTime(totalElapsedTime)} | Phase ${formatTime(currentPhaseElapsedTime)}` 
          : ""}
      </h1>
      <h2>{data}</h2> {/* API test data display */}

      {workoutStartTime === null ? (
        <div className="start-workout-container">
          <button onClick={handleStartWorkout} className="button start-workout-button">
            Start Workout
          </button>
          <p className="start-prompt-message">Click "Start Workout" to begin tracking your session.</p>
        </div>
      ) : null}

      {workoutStartTime !== null && (
        <>
          {phase < 5 ? (
            <PhaseTracker
              phase={phase}
              totalMoves={totalMoves}
              onPhaseComplete={handleNextPhase}
              onFingerboardDataChange={handleFingerboardUpdate}
              handleClimbingStatUpdate={handleClimbingStatUpdate}
              powerEnduranceSetsData={powerEnduranceSetsData}
              handlePowerEnduranceUpdate={handlePowerEnduranceUpdate}
            />
          ) : editableData ? ( // Ensure editableData is loaded before rendering summary
            <div className="summary">
              <h2>Workout Summary (Editable)</h2>

              <EditableSummaryField
                label="Stretching duration"
                value={formatDurationSummary(currentDisplayData.durations.stretching)}
                onChange={(val) => handleEditableFieldChange('stretching', val, 'timeString')}
                type="timeString"
                unit="m s"
              />
              <EditableSummaryField
                label="Hangboard duration"
                value={formatDurationSummary(currentDisplayData.durations.hangboard)}
                onChange={(val) => handleEditableFieldChange('hangboard', val, 'timeString')}
                type="timeString"
                unit="m s"
              />
              <EditableSummaryField
                label="Climbing duration"
                value={formatDurationSummary(currentDisplayData.durations.climbing)}
                onChange={(val) => handleEditableFieldChange('climbing', val, 'timeString')}
                type="timeString"
                unit="m s"
              />
              <EditableSummaryField
                label="Power Endurance duration"
                value={formatDurationSummary(currentDisplayData.durations.power_endurance)}
                onChange={(val) => handleEditableFieldChange('power_endurance', val, 'timeString')}
                type="timeString"
                unit="m s"
              />
              <EditableSummaryField
                label="Rehab duration"
                value={formatDurationSummary(currentDisplayData.durations.rehab)}
                onChange={(val) => handleEditableFieldChange('rehab', val, 'timeString')}
                type="timeString"
                unit="m s"
              />
              <EditableSummaryField
                label="Total Workout Time"
                value={formatTime(currentDisplayData.totalElapsedTime)}
                onChange={(val) => handleEditableFieldChange('totalElapsedTime', val, 'totalTimeString')}
                type="totalTimeString"
                unit="H:MM"
              />
              <EditableSummaryField
                label="Total Moves (Climbing)"
                value={String(currentDisplayData.totalMoves)} // Ensure value is string for input
                onChange={(val) => handleEditableFieldChange('totalMoves', val, 'number')}
                type="number"
                unit="moves"
              />

              <h3>Climbing Details</h3>
              {Object.keys(currentDisplayData.climbingStats).length > 0 ? (
                Object.entries(currentDisplayData.climbingStats).map(([key, count]) => {
                  const [grade, type] = key.split('_');
                  return (
                    <EditableSummaryField
                      key={key}
                      label={`${grade} - ${type}`}
                      value={String(count)}
                      onChange={(val) => handleEditableClimbingStatChange(key, val)}
                      type="number"
                      unit="count"
                    />
                  );
                })
              ) : (
                <p>No climbing details recorded.</p>
              )}
              
              <h3>Hangboard Sets</h3>
              {currentDisplayData.fingerboardData && currentDisplayData.fingerboardData.hangboardSets && currentDisplayData.fingerboardData.hangboardSets.length > 0 ? (
                currentDisplayData.fingerboardData.hangboardSets.map((set, index) => (
                  <div key={`hb-set-${index}`} style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px' }}>
                    <h4>Set {index + 1}</h4>
                    <EditableSummaryField
                      label="Weight"
                      value={String(set.weight)}
                      onChange={(val) => handleEditableHangboardSetChange(index, 'weight', val)}
                      type="number"
                      unit="lbs"
                    />
                    <EditableSummaryField
                      label="Duration"
                      value={String(set.duration)}
                      onChange={(val) => handleEditableHangboardSetChange(index, 'duration', val)}
                      type="number"
                      unit="secs"
                    />
                    <EditableSummaryField
                      label="Edge Size"
                      value={String(set.edgeSize)}
                      onChange={(val) => handleEditableHangboardSetChange(index, 'edgeSize', val)}
                      type="number"
                      unit="mm"
                    />
                  </div>
                ))
              ) : (
                <p>No hangboard sets data recorded.</p>
              )}

              <h3>Weighted Pulls</h3>
              {currentDisplayData.fingerboardData && currentDisplayData.fingerboardData.weightedPulls && currentDisplayData.fingerboardData.weightedPulls.length > 0 && currentDisplayData.fingerboardData.weightedPulls.some(set => (set.weight !== '' && String(set.weight).trim() !== '') || (set.reps !== '' && String(set.reps).trim() !== '')) ? (
                 currentDisplayData.fingerboardData.weightedPulls.map((set, index) => (
                  <div key={`wp-set-${index}`} style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px' }}>
                    <h4>Set {index + 1}</h4>
                    <EditableSummaryField
                      label="Weight"
                      value={String(set.weight)}
                      onChange={(val) => handleEditableWeightedPullSetChange(index, 'weight', val)}
                      type="number"
                      unit="lbs"
                    />
                    <EditableSummaryField
                      label="Reps"
                      value={String(set.reps)}
                      onChange={(val) => handleEditableWeightedPullSetChange(index, 'reps', val)}
                      type="number"
                      unit="reps"
                    />
                  </div>
                ))
              ) : (
                <p>No weighted pulls data recorded.</p>
              )}

              <h3>Power Endurance Climbs</h3>
              {currentDisplayData.powerEnduranceSetsData && currentDisplayData.powerEnduranceSetsData.length > 0 && currentDisplayData.powerEnduranceSetsData.some(set => set.grade !== '' && String(set.grade).trim() !== '') ? (
                currentDisplayData.powerEnduranceSetsData.map((set, index) => (
                  <div key={`pe-set-${index}`} style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px' }}>
                     <h4>Set {index + 1}</h4>
                    <EditableSummaryField
                      label="Grade"
                      value={set.grade}
                      onChange={(val) => handleEditablePowerEnduranceSetChange(index, 'grade', val)}
                      type="text"
                    />
                  </div>
                ))
              ) : (
                <p>No power endurance data recorded.</p>
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
          ) : (
            <div>Loading summary...</div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
