export function Seal({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`itqan-seal itqan-seal--${size}`} aria-label="Itqān">
      <span lang="ar" dir="rtl">ق</span>
    </div>
  )
}
