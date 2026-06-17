interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={style} />
}

export function MomentCardSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="w-full rounded-xl" style={{ paddingBottom: '133%' }} />
      <div className="flex items-center gap-2 px-1">
        <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
        <Skeleton className="h-3 rounded flex-1" />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 p-6">
      <Skeleton className="w-20 h-20 rounded-full" />
      <Skeleton className="w-32 h-4 rounded" />
      <Skeleton className="w-48 h-3 rounded" />
      <div className="flex gap-6 mt-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="w-8 h-4 rounded" />
            <Skeleton className="w-12 h-3 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
