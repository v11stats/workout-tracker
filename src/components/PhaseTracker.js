import React, { useState, useEffect } from 'react';
import Timer from './Timer';
import Counter from './Counter';
import FingerboardForm from './FingerboardForm';

const PhaseTracker = ({ phase, onPhaseComplete, totalMoves, setTotalMoves, onFingerboardDataChange }) => {
  const [time, setTime] = useState(0);

  // Reset Total Moves only when entering the Climbing Phase (Phase 1)
  useEffect(() => {
    if (phase === 1) {
      setTotalMoves(0);
    }
  }, [phase, setTotalMoves]);

  const handleComplete = () => {
    onPhaseComplete(time);
  };

  // Helper function to update Total Moves based on increments/decrements
  const updateTotalMoves = (change) => {
    setTotalMoves((prevMoves) => prevMoves + change);
  };

  const phaseContent = () => {
    if (phase === 0) {
      return (
        <div>
          <h2>Warm-up Phase</h2>
          <FingerboardForm onFingerboardDataUpdate={onFingerboardDataChange} />
        </div>
      );
    } else if (phase === 1) {
      return (
        <div>
          <h2>Climbing Phase</h2>
          {/* Main Total Moves counter */}
          <Counter
            label="Total Moves"
            increment={1}
            count={totalMoves}
            updateCount={(newCount) => setTotalMoves(newCount)}
          />
          <div className="climbing-sub-groups">
            {['<V5', 'V5-V6', 'V7-V8', 'V9-V10', 'V11+'].map((level) => (
              <div key={level} className="climbing-group">
                <h3>{level}</h3>
                <div className="counters-row">
                  {/* Each counter here will update the total moves */}
                  <Counter label="Attempts" increment={1} updateCount={updateTotalMoves} />
                  <Counter label="Sends" increment={1} updateCount={updateTotalMoves} />
                  <Counter label="Flashes" increment={1} updateCount={updateTotalMoves} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    } else if (phase === 2) {
      return (
        <div>
          <h2>Rehab Phase</h2>
          <Counter label="Rehab Sets" increment={1} />
        </div>
      );
    }
  };

  return (
    <div>
      <Timer onTimeUpdate={setTime} />
      {phaseContent()}
      <button onClick={handleComplete}>Complete Phase</button>
    </div>
  );
};

export default PhaseTracker;
