"use client";

import { useEffect, useState } from 'react';

interface TimerDisplayProps {
  initialTime: number; // in seconds
  isActive: boolean;
  onTimeUp: () => void;
  resetKey?: number; // Add a key to force re-render and reset
}

const formatTime = (timeInSeconds: number) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const TimerDisplay: React.FC<TimerDisplayProps> = ({ initialTime, isActive, onTimeUp, resetKey }) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    setTimeLeft(initialTime);
  }, [initialTime, resetKey]);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) {
      if (timeLeft <= 0 && isActive) {
         // Check isActive again because it might have changed rapidly
        onTimeUp();
      }
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(intervalId);
          onTimeUp();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isActive, timeLeft, onTimeUp]);

  return (
    <div className="text-2xl font-semibold p-2 bg-card text-card-foreground rounded-md shadow tabular-nums">
      {formatTime(timeLeft)}
    </div>
  );
};

export default TimerDisplay;
