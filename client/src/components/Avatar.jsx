const PALETTE = ['#277C78', '#82C9D7', '#F2CDAC', '#626070', '#826CB0', '#597C7C', '#93674F', '#3F82B2', '#BE6C49']

function hash(text) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** Coloured initials, generated from the name so the same payee always looks the same. */
function Avatar({ name }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
  return (
    <span className="avatar" style={{ background: PALETTE[hash(name) % PALETTE.length] }} aria-hidden="true">
      {initials || '?'}
    </span>
  )
}

export default Avatar
