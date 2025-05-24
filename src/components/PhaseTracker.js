import React from 'react'; // Removed useEffect, useState
import Counter from './Counter';
import FingerboardForm from './FingerboardForm';

// Removed setTotalMoves from props, added handleClimbingStatUpdate
const PhaseTracker = ({ phase, onPhaseComplete, totalMoves, onFingerboardDataChange, handleClimbingStatUpdate }) => {

  const handleComplete = () => {
    onPhaseComplete();
  };

  // Removed local updateTotalMoves helper function

  const phaseContent = () => {
    if (phase === 0) {
      return (
        <div>
          <h2>Warm-up Phase</h2>
          {/* Pass onFingerboardDataChange with the correct prop name expected by FingerboardForm */}
          <FingerboardForm onFingerboardDataUpdate={onFingerboardDataChange} />
        </div>
      );
    } else if (phase === 1) {
      return (
        <div>
          {/* Display totalMoves in the header */}
          <h2>Climbing Phase - Total Moves: {totalMoves}</h2>
          {/* Removed the main "Total Moves" Counter instance */}
          <div className="climbing-sub-groups">
            {['<V5', 'V5-V6', 'V7-V8', 'V9-V10', 'V11+'].map((level) => (
              <div key={level} className="climbing-group">
                <h3>{level}</h3>
                <div className="counters-row">
                  {/* Counters now use handleClimbingStatUpdate */}
                  <Counter 
                    label="Attempts" 
                    increment={1} 
                    updateCount={(incrementValue) => handleClimbingStatUpdate(level, 'attempts', incrementValue)} 
                    buttonClassName="climbing-action-button" 
                  />
                  <Counter 
                    label="Sends" 
                    increment={1} 
                    updateCount={(incrementValue) => handleClimbingStatUpdate(level, 'sends', incrementValue)} 
                    buttonClassName="climbing-action-button" 
                  />
                  <Counter 
                    label="Flashes" 
                    increment={1} 
                    updateCount={(incrementValue) => handleClimbingStatUpdate(level, 'flashes', incrementValue)} 
                    buttonClassName="climbing-action-button" 
                  />
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
          {/* Rehab counter remains self-contained or could be connected to a new state if needed */}
          <Counter label="Rehab Sets" increment={1} buttonClassName="climbing-action-button" />
        </div>
      );
    }
  };

  return (
    <div>
      {phaseContent()}
      <button onClick={handleComplete}>Complete Phase</button>
    </div>
  );
};

export default PhaseTracker;
