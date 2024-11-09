import React, { useState } from 'react';
import Timer from './Timer';
import Counter from './Counter';

const PhaseTracker = ({ phase, onPhaseComplete }) => {
  const [time, setTime] = useState(0);

  const handleComplete = () => {
    onPhaseComplete(time);
  };

  const phaseContent = () => {
    if (phase === 0) {
      return (
        <div>
          <h2>Warm-up Phase</h2>
          <Counter label="Fingerboard Hangs (lbs)" increment={1} />
        </div>
      );
    } else if (phase === 1) {
      return (
        <div>
          <h2>Climbing Phase</h2>
          <Counter label="Total Moves" increment={1} />
          <div className="climbing-sub-groups">
            {['V5-', 'V5-V6', 'V7-V8', 'V9-V10', 'V11+'].map((level) => (
              <div key={level}>
                <h3>{level}</h3>
                <Counter label={`${level} Sends`} increment={1} />
                <Counter label={`${level} Flashes`} increment={1} />
              </div>
            ))}
          </div>
        </div>
      );
    } else if (phase === 2) {
      return (
        <div>
          <h2>Rehab Phase</h2>
          <p>Track any rehab activities here if needed.</p>
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
