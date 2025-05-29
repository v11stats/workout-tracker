import React, { useState, useEffect } from 'react';
import './FingerboardForm.css';

const FingerboardForm = ({ onFingerboardDataUpdate }) => {
  const initialSets = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    weight: '', // Changed from 0 to ''
    duration: 8, // Pre-populate with 8 seconds
    edgeSize: 10, // Default edge size (now a number)
  }));

  const [sets, setSets] = useState(initialSets);
  const [weightedPulls, setWeightedPulls] = useState(
    Array.from({ length: 4 }, () => ({ weight: '', reps: '' }))
  );

  useEffect(() => {
    onFingerboardDataUpdate({ hangboardSets: sets, weightedPulls: weightedPulls });
  }, [sets, weightedPulls, onFingerboardDataUpdate]);

  const handleChange = (setId, field, value) => {
    let processedValue = value;
    if (field === 'weight' || field === 'duration') {
      processedValue = Number(value);
      if (processedValue < 0) {
        processedValue = 0;
      }
    } else if (field === 'edgeSize') {
      processedValue = parseInt(value, 10); // Convert string value to number
    }
    // Note: edgeSize is now handled as a number
    setSets(prevSets =>
      prevSets.map(set =>
        set.id === setId ? { ...set, [field]: processedValue } : set
      )
    );
  };

  const handleWeightedPullsChange = (index, field, value) => {
    setWeightedPulls(prevWeightedPulls =>
      prevWeightedPulls.map((set, i) => {
        if (i === index) {
          let processedValue;
          if (value === '') {
            processedValue = '';
          } else {
            const numVal = Number(value);
            if (isNaN(numVal)) {
              processedValue = ''; // Default to empty string for invalid non-empty strings
            } else if (numVal < 0) {
              processedValue = 0;   // Ensure value is not negative
            } else {
              processedValue = numVal; // Store the valid number
            }
          }
          return { ...set, [field]: processedValue };
        }
        return set;
      })
    );
  };

  return (
    <form className="fingerboard-form">
      <h4>Hangboard Sets</h4>
      {sets.map(set => (
        <div key={set.id} className="fingerboard-set">
          <h5>Set {set.id + 1}</h5>
          <div className="form-field">
            <label htmlFor={`hang-weight-${set.id}`}>Weight Added (lbs):</label>
            <input
              type="number"
              id={`hang-weight-${set.id}`}
              min="0"
              value={set.weight}
              onChange={e => handleChange(set.id, 'weight', e.target.value)}
              placeholder="e.g., 10" // Added placeholder
            />
          </div>
          <div className="form-field">
            <label htmlFor={`hang-duration-${set.id}`}>Hang Duration (s):</label>
            <input
              type="number"
              id={`hang-duration-${set.id}`}
              min="0"
              value={set.duration}
              onChange={e => handleChange(set.id, 'duration', e.target.value)}
            />
          </div>
          <div className="form-field edge-size-options">
            <span className="edge-size-label">Edge Size:</span>
            {['6mm', '8mm', '10mm'].map(sizeStr => {
              const numericSize = parseInt(sizeStr, 10);
              return (
                <label key={sizeStr} className="radio-label">
                  <input
                    type="radio"
                    name={`edge-size-${set.id}`}
                    value={numericSize} // Use numeric value for the input
                    checked={set.edgeSize === numericSize} // Compare with numeric state value
                    onChange={e => handleChange(set.id, 'edgeSize', e.target.value)}
                  />
                  {sizeStr} {/* Display string like "10mm" */}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <hr className="form-divider" />

      <h4>Weighted Pulls</h4>
      {weightedPulls.map((set, index) => (
        <div key={index} className="weighted-pulls-set">
          <h5>Set {index + 1}</h5>
          <div className="form-field">
            <label htmlFor={`wp-weight-${index}`}>Weight Added (lbs):</label>
            <input
              type="number"
              id={`wp-weight-${index}`}
              min="0"
              value={set.weight}
              placeholder="e.g., 10"
              onChange={e => handleWeightedPullsChange(index, 'weight', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor={`wp-reps-${index}`}>Number of Reps:</label>
            <input
              type="number"
              id={`wp-reps-${index}`}
              min="0"
              value={set.reps}
              placeholder="e.g., 5"
              onChange={e => handleWeightedPullsChange(index, 'reps', e.target.value)}
            />
          </div>
        </div>
      ))}
    </form>
  );
};

export default FingerboardForm;
