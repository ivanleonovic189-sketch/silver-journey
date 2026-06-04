import WavesBackground from './WavesBackground';

/** Оболочка: волны сзади, контент спереди */
export default function AppLayout({ children }) {
  return (
    <div className="ep-layout">
      <WavesBackground />
      <div className="ep-layout__content">{children}</div>
    </div>
  );
}