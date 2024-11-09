import React, { useState } from 'react';
import PhaseTracker from './components/PhaseTracker';
import Timer from './components/Timer';
import './App.css';

const App = () => {
  const [phase, setPhase] = useState(0);
  const [durations, setDurations] = useState({ warmUp: 0, climbing: 0, rehab: 0 });

  const handleNextPhase = (duration) => {
    if (phase === 0) setDurations((d) => ({ ...d, warmUp: duration }));
    else if (phase === 1) setDurations((d) => ({ ...d, climbing: duration }));
    else if (phase === 2) setDurations((d) => ({ ...d, rehab: duration }));

    setPhase(phase + 1);
  };

  return (
    <div className="app">
      <h1>Workout Tracker</h1>
      {phase < 3 ? (
        <PhaseTracker phase={phase} onPhaseComplete={handleNextPhase} />
      ) : (
        <div className="summary">
          <h2>Workout Summary</h2>
          <p>Warm-up duration: {durations.warmUp} seconds</p>
          <p>Climbing duration: {durations.climbing} seconds</p>
          <p>Rehab duration: {durations.rehab} seconds</p>
        </div>
      )}
    </div>
  );
};

export default App;
