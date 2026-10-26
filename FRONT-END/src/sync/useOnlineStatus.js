import { useEffect, useState } from 'react';
import { synchronize } from './syncEngine.js';

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) synchronize().catch(() => {});
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if (navigator.onLine) synchronize().catch(() => {});
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}