import { useEffect, useState } from 'react';

function getParts(endTime) {
  const distance = Math.max(0, endTime - Date.now());
  const hours = Math.floor(distance / 3600000);
  const minutes = Math.floor((distance % 3600000) / 60000);
  const seconds = Math.floor((distance % 60000) / 1000);
  return { hours, minutes, seconds };
}

export default function Countdown({ endTime, large = false }) {
  const [parts, setParts] = useState(() => getParts(endTime));
  useEffect(() => { const timer = setInterval(() => setParts(getParts(endTime)), 1000); return () => clearInterval(timer); }, [endTime]);
  const pad = (value) => String(value).padStart(2, '0');
  return <span className={large ? 'countdown large' : 'countdown'}><b>{pad(parts.hours)}</b><i>:</i><b>{pad(parts.minutes)}</b><i>:</i><b>{pad(parts.seconds)}</b>{large && <small>hours &nbsp; minutes &nbsp; seconds</small>}</span>;
}
