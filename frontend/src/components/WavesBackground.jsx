import { useEffect } from 'react';

/** Поддержка класса body (разметка волн в index.html) */
export default function WavesBackground() {
  useEffect(() => {
    document.body.classList.add('ep-has-waves');
    return () => document.body.classList.remove('ep-has-waves');
  }, []);

  return null;
}