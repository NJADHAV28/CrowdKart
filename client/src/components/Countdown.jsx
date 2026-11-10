import { useEffect, useState } from 'react';

export default function Countdown({ to, done = 'closing…' }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((to - now) / 1000));
  if (!s) return <>{done}</>;
  return <>{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</>;
}
