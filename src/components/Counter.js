import React, { useState, useEffect } from 'react';

const Counter = ({ label, increment, updateCount, count }) => {
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
    const newCount = localCount - increment;
    setLocalCount(newCount);
    if (updateCount) {
      updateCount(-increment); // Decrement Total Moves by 1
    }
  };

  return (
    <div className="counter">
      <h4>{label}</h4>
      <button onClick={handleIncrement}>+</button>
      <span>{localCount}</span>
      <button onClick={handleDecrement}>-</button>
    </div>
  );
};

export default Counter;
