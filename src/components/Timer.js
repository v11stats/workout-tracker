import React, { useEffect, useState } from 'react';

const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const paddedSecs = secs.toString().padStart(2, '0');
  const paddedMins = minutes.toString().padStart(2, '0');

  if (hours > 0) {
    const paddedHours = hours.toString().padStart(2, '0');
    return `${paddedHours}:${paddedMins}:${paddedSecs}`;
  }
  return `${paddedMins}:${paddedSecs}`;
};

const Timer = ({ onTimeUpdate }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prevSeconds) => {
        const newSeconds = prevSeconds + 1;
        onTimeUpdate(newSeconds); // Call with the new seconds value
        return newSeconds;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onTimeUpdate]); // seconds removed from dependency array as it's handled via functional update

  return (
    <div className="timer">
      <p>{formatTime(seconds)}</p>
    </div>
  );
};

export default Timer;
