export default function Loader({ user }) {
  const blockCopy = (e) => e.preventDefault();

  return (
    <div
      className="ep-loader ep-no-copy"
      onCopy={blockCopy}
      onCut={blockCopy}
      onContextMenu={blockCopy}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        gap: '0.6rem',
        overflow: 'hidden',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'inline-block',
          fontSize: '2.25rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        <span style={{ color: 'var(--text-light)' }}>Enter Pay</span>
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            color: 'var(--accent)',
            clipPath: 'inset(0 100% 0 0)',
            animation: 'loaderTextFill 1.2s ease-out forwards',
            whiteSpace: 'nowrap',
          }}
        >
          Enter Pay
        </span>
      </div>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', position: 'relative', zIndex: 1 }}>
        Загружаем ваш кабинет…
      </p>
    </div>
  );
}
