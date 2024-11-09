import React, { useState } from 'react';

const Counter = ({ label, increment }) => {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <h4>{label}</h4>
      <button onClick={() => setCount(count + increment)}>+</button>
      <span>{count}</span>
      <button onClick={() => setCount(count - increment)}>-</button>
    </div>
  );
};

export default Counter;
