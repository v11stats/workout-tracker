import React, { useState, useEffect } from 'react';
import './FingerboardForm.css';

const FingerboardForm = ({ onFingerboardDataUpdate }) => {
  const initialSets = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    weight: 0,
    duration: 8, // Pre-populate with 8 seconds
  }));

  const [sets, setSets] = useState(initialSets);

  useEffect(() => {
    onFingerboardDataUpdate(sets);
  }, [sets, onFingerboardDataUpdate]);

  const handleChange = (setId, field, value) => {
    let numericValue = Number(value);
    // Ensure weight and duration are not negative
    if (field === 'weight' || field === 'duration') {
      if (numericValue < 0) {
        numericValue = 0;
      }
    }

    setSets(prevSets =>
      prevSets.map(set =>
        set.id === setId ? { ...set, [field]: numericValue } : set
      )
    );
  };

  return (
    <form className="fingerboard-form">
      {sets.map(set => (
        <div key={set.id} className="fingerboard-set">
          <h3>Set {set.id + 1}</h3>
          <div className="form-field">
            <label htmlFor={`weight-${set.id}`}>Weight Added (lbs):</label>
            <input
              type="number"
              id={`weight-${set.id}`}
              min="0" // Prevent negative numbers at browser level
              value={set.weight}
              onChange={e => handleChange(set.id, 'weight', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor={`duration-${set.id}`}>Hang Duration (s):</label>
            <input
              type="number"
              id={`duration-${set.id}`}
              min="0" // Also ensure duration is not negative
              value={set.duration}
              onChange={e => handleChange(set.id, 'duration', e.target.value)}
            />
          </div>
        </div>
      ))}
    </form>
  );
};

export default FingerboardForm;
