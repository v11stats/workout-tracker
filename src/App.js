import React, { useState, useEffect } from 'react';
import PhaseTracker from './components/PhaseTracker';
import Timer from './components/Timer';
import './App.css';
import { fetchData } from './api';

function App() {
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState(0);
  const [durations, setDurations] = useState({ warmUp: 0, climbing: 0, rehab: 0 });
  const [totalMoves, setTotalMoves] = useState(0);

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

  return (
    <div className="app">
      <h1>Workout Tracker</h1>
      <h2>{data ? data : 'Loading data...'}</h2>
      {phase < 3 ? (
        <PhaseTracker
          phase={phase}
          onPhaseComplete={handleNextPhase}
          totalMoves={totalMoves}
          setTotalMoves={setTotalMoves}
        />
      ) : (
        <div className="summary">
          <h2>Workout Summary</h2>
          <p>Warm-up duration: {durations.warmUp} seconds</p>
          <p>Climbing duration: {durations.climbing} seconds</p>
          <p>Rehab duration: {durations.rehab} seconds</p>
          <p>Total Moves during Climbing Phase: {totalMoves}</p>
        </div>
      )}
    </div>
  );
}

export default App;
