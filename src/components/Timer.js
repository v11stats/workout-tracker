import React, { useEffect, useState } from 'react';

export const formatTime = (totalSeconds) => { // Added export keyword
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

const Timer = ({ onTimeUpdate, startTime }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (startTime) {
      // Calculate initial elapsed time
      const initialElapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      setSeconds(initialElapsedSeconds);
      onTimeUpdate(initialElapsedSeconds);

      const interval = setInterval(() => {
        const currentElapsedTime = Math.floor((Date.now() - startTime) / 1000);
        setSeconds(currentElapsedTime);
        onTimeUpdate(currentElapsedTime);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      // Original behavior: increment seconds from 0
      const interval = setInterval(() => {
        setSeconds((prevSeconds) => {
          const newSeconds = prevSeconds + 1;
          onTimeUpdate(newSeconds); // Call with the new seconds value
          return newSeconds;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [onTimeUpdate, startTime]);

  return (
    <div className="timer">
      <p>{formatTime(seconds)}</p>
    </div>
  );
};

export default Timer;
