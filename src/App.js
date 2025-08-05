import React, { useState, useEffect, useCallback } from 'react';
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

// Store credentials in a more manageable way, still client-side
const USER_CREDENTIALS = {
  Mike: { email: 'mike-app-user@example.com', password: 'PearWiggleTrunkSeven47' },
  Patti: { email: 'patti-app-user@example.com', password: 'CrotchTrouserPostcard505' },
};

let currentProgrammaticUser = null; // Keep track of who is programmatically logged in

async function ensureUserLoggedIn(userName, setDebugMessage) { // Accept the debug setter
  setDebugMessage(`Ensuring login for ${userName}.`);
  if (!USER_CREDENTIALS[userName]) {
    const errorMsg = `No credentials found for user ${userName}`;
    setDebugMessage(`Error: ${errorMsg}`);
    console.error(errorMsg);
    alert(`Configuration error: No credentials for ${userName}.`);
    return false;
  }

  const { data: { user: activeUser } } = await supabase.auth.getUser();

  if (activeUser && activeUser.email === USER_CREDENTIALS[userName].email) {
    setDebugMessage(`${userName} is already logged in.`);
    console.log(`${userName} is already logged in programmatically.`);
    currentProgrammaticUser = userName;
    return true; // Correct user is already logged in
  }

  // If a different user is logged in, or no one is, sign out first
  if (activeUser) {
    setDebugMessage(`Logging out ${activeUser.email} to switch to ${userName}.`);
    console.log(`Logging out current user: ${activeUser.email} before switching to ${userName}`);
    await supabase.auth.signOut();
    currentProgrammaticUser = null;
  }

  setDebugMessage(`Attempting programmatic login for ${userName}...`);
  console.log(`Attempting programmatic login for ${userName}...`);
  const { email, password } = USER_CREDENTIALS[userName];
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

  if (loginError) {
    const errorMsg = `Login error for ${userName}: ${loginError.message}`;
    setDebugMessage(`Error: ${errorMsg}`);
    console.error(`Programmatic login error for ${userName}:`, loginError);
    alert(`Failed to prepare session for ${userName}. Data not saved. Error: ${loginError.message}`);
    return false;
  }

  if (loginData.user) {
    setDebugMessage(`Login successful for ${userName}. UID: ${loginData.user.id}`);
    console.log(`Programmatic login successful for ${userName}. User ID: ${loginData.user.id}`);
    currentProgrammaticUser = userName;
    // Store the session. Supabase client does this automatically by default.
    // You might want to explicitly handle session persistence if needed beyond default.
  }
  return true;
}


function App() {
  const [debugMessage, setDebugMessage] = useState('App loaded. No actions yet.'); // Debug UI state
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

  // Effect to recalculate total workout time when durations change in the editable summary
  useEffect(() => {
    if (editableData && editableData.durations) {
      const { stretching, hangboard, climbing, power_endurance, rehab } = editableData.durations;
      const newTotalElapsedTime = (stretching || 0) + (hangboard || 0) + (climbing || 0) + (power_endurance || 0) + (rehab || 0);

      // Check if the total time has actually changed to prevent an infinite loop
      if (newTotalElapsedTime !== editableData.totalElapsedTime) {
        setEditableData(prev => ({ ...prev, totalElapsedTime: newTotalElapsedTime }));
      }
    }
  }, [editableData?.durations]);

  // Effect to recalculate total moves when climbing stats change in the editable summary
  useEffect(() => {
    if (editableData && editableData.climbingStats) {
      const newTotalMoves = Object.values(editableData.climbingStats).reduce((sum, count) => sum + (count || 0), 0);
      if (newTotalMoves !== editableData.totalMoves) {
        setEditableData(prev => ({ ...prev, totalMoves: newTotalMoves }));
      }
    }
  }, [editableData?.climbingStats]);


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

  const saveWorkoutData = async (userName) => { // userName is "Mike" or "Patti"
    setDebugMessage(`Starting save process for ${userName}...`);
    const loggedIn = await ensureUserLoggedIn(userName, setDebugMessage); // Pass setter to the function
    if (!loggedIn) {
      setDebugMessage(prev => `${prev} | Save process halted due to login failure.`);
      console.log(`Skipping save for ${userName} due to login failure.`);
      return;
    }

    // At this point, the correct user (Mike or Patti) should be programmatically logged in.
    // Their auth.uid() will be used by RLS.

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
        const errorMsg = "No authenticated user found after login attempt. Cannot save data.";
        setDebugMessage(errorMsg);
        alert(errorMsg);
        console.error("SaveWorkoutData: No authenticated user found after ensureUserLoggedIn.");
        return;
    }
    const currentAuthUserId = currentUser.id; // This is the auth.uid() of Mike or Patti

    // Now, we need to ensure the `user_id` in our `public.users` table matches this `currentAuthUserId`.
    // The RLS policies on `workout_sessions` and `workout_data` are:
    // `USING ( (select auth.uid()) = user_id )` for `workout_sessions` (where user_id is the FK to public.users)
    // `USING ( (select auth.uid()) = (SELECT user_id FROM workout_sessions WHERE session_id = workout_data.session_id) )` for `workout_data`

    // This means the `user_id` column in your `public.workout_sessions` table MUST BE the Supabase Auth UID.
    // Let's verify if your `public.users` table stores these Auth UIDs.
    // If `public.users.user_id` is NOT the auth UID, the RLS policies will fail.

    // Original logic to get internal user_id based on name:
    setDebugMessage(prev => `${prev} | Fetching user entry for '${userName}' from public.users...`);
    // Changed from .single() to a normal select to debug the 406 error.
    // .single() throws an error if 0 rows are returned by RLS, which can be misleading.
    let { data: users, error: userFetchError } = await supabase
      .from('users')
      .select('user_id, name') // Select name for confirmation
      .eq('name', userName); // Fetching based on "Mike" or "Patti"

    if (userFetchError) {
      const errorMsg = `API error fetching user '${userName}': ${userFetchError.message}. Check RLS policy on 'users' table.`;
      setDebugMessage(`Error: ${errorMsg}`);
      console.error(`Error fetching user '${userName}' from public.users table:`, userFetchError);
      alert(errorMsg);
      return;
    }

    if (!users || users.length === 0) {
      const errorMsg = `No user entry found for '${userName}' in 'users' table. RLS is likely preventing access. Ensure the SELECT policy on 'public.users' allows the authenticated user to see their own row.`;
      setDebugMessage(`Error: ${errorMsg}`);
      alert(errorMsg);
      return;
    }

    if (users.length > 1) {
      const errorMsg = `Multiple users found with name '${userName}'. Data not saved for safety.`;
      setDebugMessage(`Error: ${errorMsg}`);
      alert(errorMsg);
      return;
    }

    const usersTableEntry = users[0];

    // CRITICAL CHECK: The user_id from your public.users table for "Mike" or "Patti"
    // MUST match the currentAuthUserId (the Supabase Auth UID for the programmatically logged-in user).
    if (usersTableEntry.user_id !== currentAuthUserId) {
        const errorMsg = `Data integrity error: User ID in 'users' table (${usersTableEntry.user_id}) does not match Auth UID (${currentAuthUserId}).`;
        setDebugMessage(`Error: ${errorMsg}`);
        console.error(`Mismatch between public.users.user_id (${usersTableEntry.user_id} for ${userName}) and auth.uid (${currentAuthUserId}).`);
        alert(`Data integrity issue: The user ID for ${userName} in the 'users' table does not match their authentication ID. Please ensure the 'user_id' in the 'public.users' table for Mike and Patti is their actual Supabase Authentication UID.`);

        // Log out the programmatically signed-in user as a precaution
        await supabase.auth.signOut();
        currentProgrammaticUser = null;
        return;
    }

    setDebugMessage(prev => `${prev} | UIDs match. Proceeding with save.`);
    console.log(`Confirmed: ${userName}'s entry in public.users table (ID: ${usersTableEntry.user_id}) matches current Auth UID (${currentAuthUserId}). Proceeding with save.`);

    const internalUserIdForSession = usersTableEntry.user_id; // This is now confirmed to be the Auth UID.

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
      // const userId = usersTableEntry.user_id; // This is now internalUserIdForSession and confirmed to be Auth UID

      const sessionEndTime = new Date().toISOString();

      // The user_id being inserted here (internalUserIdForSession) is the Supabase Auth UID
      // of the programmatically logged-in user. RLS policy `(select auth.uid()) = user_id` will pass.
      const { data: session, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert([
          { user_id: internalUserIdForSession, start_time: sessionStartTimeToSave, end_time: sessionEndTime }
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
        if (count > 0) {
          const [grade, type] = key.split('_');
          dataToInsert.push({
            session_id: sessionId,
            category: 'climbing_stats',
            variable_name: `${grade}_${type}`,
            value: String(count),
            unit: 'count'
          });
        }
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

      // Optionally, sign out the programmatic user after successful save if sessions should be short-lived
      // await supabase.auth.signOut();
      // currentProgrammaticUser = null;
      // console.log(`Programmatic user ${userName} signed out after saving data.`);

    } catch (error) {
      console.error('Unexpected error in saveWorkoutData:', error);
      alert('An unexpected error occurred while saving data.');
      // Potentially sign out if an error occurs mid-process after login
      if (currentProgrammaticUser) {
        await supabase.auth.signOut();
        currentProgrammaticUser = null;
        console.log(`Programmatic user ${currentProgrammaticUser} signed out due to error during save.`);
      }
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
                maxLength="10"
              />
              <EditableSummaryField
                label="Hangboard duration"
                value={formatDurationSummary(currentDisplayData.durations.hangboard)}
                onChange={(val) => handleEditableFieldChange('hangboard', val, 'timeString')}
                type="timeString"
                unit="m s"
                maxLength="10"
              />
              <EditableSummaryField
                label="Climbing duration"
                value={formatDurationSummary(currentDisplayData.durations.climbing)}
                onChange={(val) => handleEditableFieldChange('climbing', val, 'timeString')}
                type="timeString"
                unit="m s"
                maxLength="10"
              />
              <EditableSummaryField
                label="Power Endurance duration"
                value={formatDurationSummary(currentDisplayData.durations.power_endurance)}
                onChange={(val) => handleEditableFieldChange('power_endurance', val, 'timeString')}
                type="timeString"
                unit="m s"
                maxLength="10"
              />
              <EditableSummaryField
                label="Rehab duration"
                value={formatDurationSummary(currentDisplayData.durations.rehab)}
                onChange={(val) => handleEditableFieldChange('rehab', val, 'timeString')}
                type="timeString"
                unit="m s"
                maxLength="10"
              />
              <EditableSummaryField
                label="Total Workout Time"
                value={formatTime(currentDisplayData.totalElapsedTime)}
                readOnly={true}
                type="totalTimeString"
                unit="H:MM"
                maxLength="10"
              />
              <EditableSummaryField
                label="Total Moves (Climbing)"
                value={String(currentDisplayData.totalMoves)} // Ensure value is string for input
                readOnly={true}
                type="number"
                unit="moves"
                maxLength="10"
              />

              <h3>Climbing Details</h3>
              {(() => {
                const grades = ['<V5', 'V5-V6', 'V7-V8', 'V9-V10', 'V11+'];
                const statTypes = {
                  attempts: 'A',
                  sends: 'S',
                  flashes: 'F'
                };

                // Check if there is any climbing data at all
                const hasClimbingData = grades.some(grade =>
                  Object.keys(statTypes).some(type =>
                    currentDisplayData.climbingStats[`${grade}_${type}`] > 0
                  )
                );

                if (!hasClimbingData && Object.keys(currentDisplayData.climbingStats).length === 0) {
                  return <p>No climbing details recorded.</p>;
                }

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Grade</th>
                        {Object.values(statTypes).map(label => <th key={label} style={{ textAlign: 'center' }}>{label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                    {grades.map(grade => (
                      <tr key={grade}>
                        <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{grade}</td>
                        {Object.keys(statTypes).map(type => {
                          const key = `${grade}_${type}`;
                          const value = currentDisplayData.climbingStats[key] || 0;
                          return (
                            <td key={key} style={{ textAlign: 'center' }}>
                              <EditableSummaryField
                                value={String(value)}
                                onChange={(val) => handleEditableClimbingStatChange(key, val)}
                                type="number"
                                maxLength="2"
                                style={{ width: '3em', textAlign: 'center' }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    </tbody>
                  </table>
                );
              })()}
              
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
                      maxLength="4"
                    />
                    <EditableSummaryField
                      label="Duration"
                      value={String(set.duration)}
                      onChange={(val) => handleEditableHangboardSetChange(index, 'duration', val)}
                      type="number"
                      unit="secs"
                      maxLength="4"
                    />
                    <EditableSummaryField
                      label="Edge Size"
                      value={String(set.edgeSize)}
                      onChange={(val) => handleEditableHangboardSetChange(index, 'edgeSize', val)}
                      type="number"
                      unit="mm"
                      maxLength="4"
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
