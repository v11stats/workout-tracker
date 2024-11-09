import React, { useEffect, useState } from 'react';

const Timer = ({ onTimeUpdate }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
      onTimeUpdate(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [seconds, onTimeUpdate]);

  return (
    <div className="timer">
      <p>Time Elapsed: {seconds} seconds</p>
    </div>
  );
};

export default Timer;
