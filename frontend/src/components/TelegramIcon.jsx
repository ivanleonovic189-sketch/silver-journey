export default function TelegramIcon({ size = 24 }) {
  return (
    <video
      src="/tg.webm"
      width={size}
      height={size}
      autoPlay
      loop
      muted
      playsInline
      aria-label="Telegram"
      style={{
        display: 'block',
        flexShrink: 0,
        objectFit: 'contain',
      }}
    />
  );
}
