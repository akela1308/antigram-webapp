interface AvatarProps {
  url: string | null | undefined
  name: string | null | undefined
  size?: number
  className?: string
}

export function Avatar({ url, name, size = 36, className = '' }: AvatarProps) {
  const initials = (name ?? '?').slice(0, 1).toUpperCase()

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? ''}
        width={size}
        height={size}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        onError={e => {
          (e.target as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: 'rgba(201,132,62,0.2)',
        color: 'var(--amber)',
        border: '1px solid var(--border)',
      }}
    >
      {initials}
    </div>
  )
}
