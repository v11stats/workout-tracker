import React, { useState, useEffect } from 'react';
import './FingerboardForm.css';

const FingerboardForm = ({ onFingerboardDataUpdate }) => {
  const initialSets = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    weight: 0,
    duration: 0,
  }));

  const [sets, setSets] = useState(initialSets);

  useEffect(() => {
    onFingerboardDataUpdate(sets);
  }, [sets, onFingerboardDataUpdate]);

  const handleChange = (setId, field, value) => {
    setSets(prevSets =>
      prevSets.map(set =>
        set.id === setId ? { ...set, [field]: Number(value) } : set
      )
    );
  };

  return (
    <form className="fingerboard-form">
      {sets.map(set => (
        <div key={set.id} className="fingerboard-set">
          <h3>Set {set.id + 1}</h3>
          <div className="form-field">
            <label htmlFor={`weight-${set.id}`}>Weight Added (kg):</label>
            <input
              type="number"
              id={`weight-${set.id}`}
              value={set.weight}
              onChange={e => handleChange(set.id, 'weight', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor={`duration-${set.id}`}>Hang Duration (s):</label>
            <input
              type="number"
              id={`duration-${set.id}`}
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
