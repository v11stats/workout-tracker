import React, { useState, useEffect } from 'react';

const Counter = ({ label, increment, updateCount, count, buttonClassName }) => {
  const [localCount, setLocalCount] = useState(count || 0);

  useEffect(() => {
    if (count !== undefined) {
      setLocalCount(count);
    }
  }, [count]);

  const handleIncrement = () => {
    const newCount = localCount + increment;
    setLocalCount(newCount);
    if (updateCount) {
      updateCount(increment); // Increment Total Moves by 1
    }
  };

  const handleDecrement = () => {
    if (localCount === 0) return; // If already at 0, do nothing

    const newCountCandidate = localCount - increment;
    const newLocalCountValue = newCountCandidate < 0 ? 0 : newCountCandidate;
    
    setLocalCount(newLocalCountValue);

    if (updateCount) {
      // Only call updateCount if localCount was originally > 0
      if (localCount > 0) {
        // The actual change in value.
        // If localCount was 5 and increment is 2, newLocalCountValue is 3. actualDecrement is -2.
        // If localCount was 1 and increment is 2, newLocalCountValue is 0. actualDecrement is -1.
        const actualDecrement = newLocalCountValue - localCount; 
        if (actualDecrement !== 0) { // Only call if there's a non-zero change
          updateCount(actualDecrement);
        }
      }
    }
  };

  return (
    <div className="counter">
      <h4>{label}</h4>
      <button onClick={handleIncrement} className={buttonClassName}>+</button>
      <span>{localCount}</span>
      <button onClick={handleDecrement} className={buttonClassName}>-</button>
    </div>
  );
};

export default Counter;
