import { writeFileSync, readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env so we can query Supabase at build time
const envPath = resolve(import.meta.dirname, '..', '.env')
try {
  const envText = readFileSync(envPath, 'utf-8')
  for (const line of envText.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) process.env[match[1]] = match[2]
  }
} catch { /* .env may not exist in CI — variables should be in environment */ }

const BASE_URL = process.env.VITE_SITE_URL || 'https://newfrontiers.example.com'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''

const ROUTES: { path: string; priority: number; changefreq: string }[] = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/services', priority: 0.9, changefreq: 'weekly' },
  { path: '/jobs', priority: 0.9, changefreq: 'daily' },
  { path: '/clients', priority: 0.8, changefreq: 'monthly' },
  { path: '/industries', priority: 0.7, changefreq: 'monthly' },
  { path: '/candidates', priority: 0.7, changefreq: 'monthly' },
  { path: '/about', priority: 0.6, changefreq: 'monthly' },
  { path: '/contact', priority: 0.6, changefreq: 'monthly' },
  { path: '/privacy', priority: 0.3, changefreq: 'yearly' },
  { path: '/terms', priority: 0.3, changefreq: 'yearly' },
]

interface PublicJobRow { slug: string }

async function fetchJobSlugs(): Promise<string[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[sitemap] Missing Supabase credentials — skipping per-job URLs.')
    return []
  }
  const url = `${SUPABASE_URL}/rest/v1/public_jobs?select=slug`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!res.ok) {
    console.warn(`[sitemap] Failed to fetch public_jobs (${res.status}). Skipping per-job URLs.`)
    return []
  }
  const rows: PublicJobRow[] = await res.json()
  return rows.map(r => r.slug).filter(Boolean)
}

async function main() {
  const slugs = await fetchJobSlugs()

  const allUrls = [
    ...ROUTES.map(r => ({
      loc: `${BASE_URL}${r.path}`,
      priority: r.priority.toFixed(1),
      changefreq: r.changefreq,
    })),
    ...slugs.map(slug => ({
      loc: `${BASE_URL}/jobs/${slug}`,
      priority: '0.7',
      changefreq: 'weekly',
    })),
  ]

  const urlXml = allUrls
    .map(
      u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlXml}
</urlset>
`

  const robots = `User-agent: *
Allow: /
Disallow: /app/
Disallow: /login

Sitemap: ${BASE_URL}/sitemap.xml
`

  const publicDir = resolve(import.meta.dirname, '..', 'public')

  writeFileSync(resolve(publicDir, 'sitemap.xml'), sitemap, 'utf-8')
  console.log(`Generated public/sitemap.xml (${allUrls.length} URLs, ${slugs.length} job pages)`)

  writeFileSync(resolve(publicDir, 'robots.txt'), robots, 'utf-8')
  console.log('Generated public/robots.txt')
}

main().catch(e => {
  console.error('[sitemap] Fatal error:', e)
  process.exit(1)
})
