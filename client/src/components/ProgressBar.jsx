function ProgressBar({ value, color, label, thick = false }) {
  return (
    <div
      className={`progress ${thick ? 'thick' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

export default ProgressBar
