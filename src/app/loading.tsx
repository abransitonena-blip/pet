export default function Loading() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header skeleton */}
      <div className="h-16 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="section-container h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton w-9 h-9 rounded-xl" />
            <div className="space-y-1.5">
              <div className="skeleton w-20 h-3 rounded" />
              <div className="skeleton w-32 h-4 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="skeleton w-20 h-8 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="section-container py-20">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <div className="skeleton w-48 h-6 rounded-full mx-auto" />
          <div className="skeleton w-full h-12 rounded-xl" />
          <div className="skeleton w-3/4 h-12 rounded-xl mx-auto" />
          <div className="skeleton w-full h-5 rounded mx-auto" />
          <div className="skeleton w-full h-5 rounded mx-auto" />
          <div className="flex justify-center gap-3 mt-6">
            <div className="skeleton w-36 h-12 rounded-xl" />
            <div className="skeleton w-36 h-12 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Trust bar skeleton */}
      <div className="section-container py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Sections skeleton */}
      <div className="section-container py-16 space-y-4">
        <div className="skeleton h-8 w-48 rounded mx-auto" />
        <div className="skeleton h-4 w-64 rounded mx-auto" />
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
