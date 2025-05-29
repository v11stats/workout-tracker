import React from 'react'; // Removed useEffect, useState
import Counter from './Counter';
import FingerboardForm from './FingerboardForm';
import './PhaseTracker.css'; // Assuming you might want to add specific styles

// Added powerEnduranceSetsData and handlePowerEnduranceUpdate to props
const PhaseTracker = ({ 
  phase, 
  onPhaseComplete, 
  totalMoves, 
  onFingerboardDataChange, 
  handleClimbingStatUpdate,
  powerEnduranceSetsData, // New prop
  handlePowerEnduranceUpdate // New prop
}) => {

  const handleComplete = () => {
    onPhaseComplete();
  };

  // Removed local updateTotalMoves helper function

  const phaseContent = () => {
    if (phase === 0) {
      return (
        <div>
          <h2>Stretching and Easy Climbing Phase</h2>
          <p>Focus on dynamic stretches and light movement. Remember to listen to your body.</p>
        </div>
      );
    } else if (phase === 1) {
      return (
        <div>
          <h2>Hangboard Phase</h2>
          {/* Pass onFingerboardDataChange with the correct prop name expected by FingerboardForm */}
          <FingerboardForm onFingerboardDataUpdate={onFingerboardDataChange} />
        </div>
      );
    } else if (phase === 2) {
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
    } else if (phase === 3) { // New Power Endurance Phase
      return (
        <div>
          <h2>Power Endurance Climbs</h2>
          <p>Record the grade for each of your 3 power endurance sets.</p>
          <div className="power-endurance-sets">
            {powerEnduranceSetsData.map((set, index) => (
              <div key={index} className="power-endurance-set-input">
                <label htmlFor={`pe-grade-${index}`}>Set {index + 1} Grade:</label>
                <input
                  type="text"
                  id={`pe-grade-${index}`}
                  placeholder="Enter grade (e.g., V5)"
                  value={set.grade}
                  onChange={(e) => handlePowerEnduranceUpdate(index, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      );
    } else if (phase === 4) { // Adjusted Rehab Phase
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
      <button onClick={handleComplete} className="complete-phase-button">Complete Phase</button>
    </div>
  );
};

export default PhaseTracker;
