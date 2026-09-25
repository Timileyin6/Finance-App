/** A label/value pair with the coloured left bar from the original design. */
function LegendItem({ color, label, value }) {
  return (
    <div className="legend-item" style={{ '--bar': color }}>
      <p className="muted small">{label}</p>
      <p className="strong">{value}</p>
    </div>
  )
}

export default LegendItem
