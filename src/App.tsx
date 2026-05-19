import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Loader2 } from 'lucide-react'
import { AuthProvider } from './context/AuthContext'
import AuthGuard from './components/AuthGuard'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'

// ── Route-level code splitting ──────────────────────────────────────────────
// Auth pages (small, load eagerly for instant login)
import LoginPage from './pages/LoginPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ChangePasswordPage from './pages/ChangePasswordPage'

// Internal app pages (lazy)
const HomePage = lazy(() => import('./pages/HomePage'))
const UploadPage = lazy(() => import('./pages/UploadPage'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const RequestsPage = lazy(() => import('./pages/RequestsPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ClientsPage = lazy(() => import('./pages/ClientsPage'))
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'))
const ContactDetailPage = lazy(() => import('./pages/ContactDetailPage'))
const JobDetailPage = lazy(() => import('./pages/JobDetailPage'))
const OffersPlacementsPage = lazy(() => import('./pages/OffersPlacementsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

// Marketing (public) pages (lazy)
import MarketingLayout from './layouts/MarketingLayout'
const MktHomePage = lazy(() => import('./pages/marketing/HomePage'))
const MktServicesPage = lazy(() => import('./pages/marketing/ServicesPage'))
const MktIndustriesPage = lazy(() => import('./pages/marketing/IndustriesPage'))
const MktJobsPage = lazy(() => import('./pages/marketing/JobsPage'))
const MktClientsPage = lazy(() => import('./pages/marketing/ClientsPage'))
const MktCandidatesPage = lazy(() => import('./pages/marketing/CandidatesPage'))
const MktAboutPage = lazy(() => import('./pages/marketing/AboutPage'))
const MktContactPage = lazy(() => import('./pages/marketing/ContactPage'))
const MktPrivacyPage = lazy(() => import('./pages/marketing/PrivacyPage'))
const MktTermsPage = lazy(() => import('./pages/marketing/TermsPage'))
const MktPublicJobDetailPage = lazy(() => import('./pages/marketing/PublicJobDetailPage'))
const MktJobApplyPage = lazy(() => import('./pages/marketing/JobApplyPage'))
const MktJobApplyAppliedPage = lazy(() => import('./pages/marketing/JobApplyAppliedPage'))
const MktNotFoundPage = lazy(() => import('./pages/marketing/NotFoundPage'))

function RouteSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<RouteSpinner />}>
            <Routes>
              {/* Public auth flows */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/accept-invite"   element={<AcceptInvitePage />} />
              <Route path="/auth/reset-password"  element={<ResetPasswordPage />} />

              {/* Forced password change — requires session but no Layout */}
              <Route
                path="/change-password"
                element={
                  <AuthGuard>
                    <ChangePasswordPage />
                  </AuthGuard>
                }
              />

              {/* ── Internal app — all routes under /app/* ───────────────── */}
              <Route
                path="/app/*"
                element={
                  <AuthGuard>
                    <Layout>
                      <Suspense fallback={<RouteSpinner />}>
                        <Routes>
                          <Route index                   element={<Navigate to="/app/dashboard" replace />} />
                          <Route path="/dashboard"       element={<HomePage />} />
                          <Route path="/upload"          element={<UploadPage />} />
                          <Route path="/contacts"        element={<ContactsPage />} />
                          <Route path="/contacts/:id"    element={<ContactDetailPage />} />
                          <Route path="/clients"         element={<ClientsPage />} />
                          <Route path="/clients/:id"     element={<ClientDetailPage />} />
                          <Route path="/jobs"            element={<RequestsPage />} />
                          <Route path="/jobs/:id"        element={<JobDetailPage />} />
                          <Route path="/offers"          element={<OffersPlacementsPage />} />
                          <Route path="/reports"         element={<ReportsPage />} />
                          <Route path="/search"          element={<SearchPage />} />
                          <Route path="/settings"        element={<SettingsPage />} />
                          <Route path="/admin"           element={<AdminPage />} />
                        </Routes>
                      </Suspense>
                    </Layout>
                  </AuthGuard>
                }
              />

              {/* ── Marketing (public) routes ─────────────────────────────── */}
              <Route element={<MarketingLayout />}>
                <Route index             element={<MktHomePage />} />
                <Route path="/services"   element={<MktServicesPage />} />
                <Route path="/industries" element={<MktIndustriesPage />} />
                <Route path="/jobs"       element={<MktJobsPage />} />
                <Route path="/jobs/:slug" element={<MktPublicJobDetailPage />} />
                <Route path="/jobs/:slug/apply" element={<MktJobApplyPage />} />
                <Route path="/jobs/:slug/applied" element={<MktJobApplyAppliedPage />} />
                <Route path="/clients"    element={<MktClientsPage />} />
                <Route path="/candidates" element={<MktCandidatesPage />} />
                <Route path="/about"      element={<MktAboutPage />} />
                <Route path="/contact"    element={<MktContactPage />} />
                <Route path="/privacy"    element={<MktPrivacyPage />} />
                <Route path="/terms"      element={<MktTermsPage />} />
                <Route path="*"           element={<MktNotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </HelmetProvider>
  )
}
