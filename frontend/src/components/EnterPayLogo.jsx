const SIZES = {
  xs: { fontSize: '0.975rem', letterSpacing: '-0.025em' },
  sm: { fontSize: '1.05rem', letterSpacing: '-0.02em' },
  md: { fontSize: '1.5rem', letterSpacing: '-0.02em' },
  lg: { fontSize: '1.75rem', letterSpacing: '-0.02em' },
};

export default function EnterPayLogo({ size = 'md', className, style }) {
  const sizeStyle = SIZES[size] || SIZES.md;

  return (
    <div
      className={className}
      style={{
        fontWeight: 700,
        color: 'var(--text)',
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
        ...sizeStyle,
        ...style,
      }}
    >
      Enter <span style={{ color: 'var(--accent)' }}>Pay</span>
    </div>
  );
}
