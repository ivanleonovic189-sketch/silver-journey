import { useEffect } from 'react';

const WAVE_PATH =
  'M-360,120 C-120,40 120,200 360,120 S840,40 1080,120 S1560,200 1800,120 S2280,40 2520,120 S3000,200 3240,120';

export default function WavesBackground() {
  useEffect(() => {
    document.body.classList.add('ep-has-waves');
    return () => document.body.classList.remove('ep-has-waves');
  }, []);

  return (
    <div id="ep-waves-mount" aria-hidden="true">
      <div className="ep-waves ep-waves--minimal">
        <div className="ep-waves__ambient" />
        <svg className="ep-waves__layer ep-waves__layer--1" viewBox="0 0 2880 240" preserveAspectRatio="none">
          <path d={WAVE_PATH} />
        </svg>
        <svg className="ep-waves__layer ep-waves__layer--2" viewBox="0 0 2880 240" preserveAspectRatio="none">
          <path d="M-360,140 C-60,220 180,60 360,140 S780,220 1080,140 S1500,60 1800,140 S2220,220 2520,140 S2940,60 3240,140" />
        </svg>
        <svg className="ep-waves__layer ep-waves__layer--3" viewBox="0 0 2880 240" preserveAspectRatio="none">
          <path d="M-360,100 C0,180 240,20 360,100 S720,180 1080,100 S1440,20 1800,100 S2160,180 2520,100 S2880,20 3240,100" />
        </svg>
        <div className="ep-waves__grid" />
      </div>
    </div>
  );
}
