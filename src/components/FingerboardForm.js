import React, { useState, useEffect } from 'react';
import './FingerboardForm.css';

const FingerboardForm = ({ onFingerboardDataUpdate }) => {
  const initialSets = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    weight: 0,
    duration: 8, // Pre-populate with 8 seconds
  }));

  const [sets, setSets] = useState(initialSets);
  const [weightedPulls, setWeightedPulls] = useState({ weight: '', reps: '' });

  useEffect(() => {
    onFingerboardDataUpdate({ hangboardSets: sets, weightedPulls: weightedPulls });
  }, [sets, weightedPulls, onFingerboardDataUpdate]);

  const handleChange = (setId, field, value) => {
    let numericValue = Number(value);
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

  const handleWeightedPullsChange = (field, value) => {
    let numericValue = Number(value);
    if (numericValue < 0) {
      numericValue = 0;
    }
    setWeightedPulls(prev => ({ ...prev, [field]: value === '' ? '' : numericValue }));
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
        </div>
      ))}

      <hr className="form-divider" />

      <h4>Weighted Pulls</h4>
      <div className="weighted-pulls-section">
        <div className="form-field">
          <label htmlFor="wp-weight">Weight Added (lbs):</label>
          <input
            type="number"
            id="wp-weight"
            min="0"
            value={weightedPulls.weight}
            placeholder="e.g., 10"
            onChange={e => handleWeightedPullsChange('weight', e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="wp-reps">Number of Reps:</label>
          <input
            type="number"
            id="wp-reps"
            min="0"
            value={weightedPulls.reps}
            placeholder="e.g., 5"
            onChange={e => handleWeightedPullsChange('reps', e.target.value)}
          />
        </div>
      </div>
    </form>
  );
};

export default FingerboardForm;
