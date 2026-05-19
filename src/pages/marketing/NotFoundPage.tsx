import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="text-primary text-sm font-medium uppercase tracking-wider mb-3">Error</p>
        <h1 className="text-4xl md:text-6xl font-semibold text-foreground tracking-tight">
          404 — Page not found
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block mt-8 px-6 py-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </section>
  )
}
