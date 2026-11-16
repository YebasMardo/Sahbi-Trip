import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import LandingPage from './pages/LandingPage.tsx'
import DashboardHomePage from './pages/DashboardHomePage.tsx'
import TripsListPage from './pages/TripsListPage.tsx'
import TripOverviewPage from './pages/TripOverviewPage.tsx'
import TripDayPage from './pages/TripDayPage.tsx'
import TripWizardPage from './pages/TripWizardPage.tsx'
import ActivityDetailPage from './pages/ActivityDetailPage.tsx'
import LoginPage from './pages/auth/LoginPage.tsx'
import SignupPage from './pages/auth/SignupPage.tsx'
import VerifyEmailPage from './pages/auth/VerifyEmailPage.tsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.tsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.tsx'
import AuthBoot from './routing/AuthBoot.tsx'
import ProtectedRoute from './routing/ProtectedRoute.tsx'
import { store } from './store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AuthBoot>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardHomePage /></ProtectedRoute>} />
            <Route path="/dashboard/trips" element={<ProtectedRoute><TripsListPage /></ProtectedRoute>} />
            <Route path="/dashboard/trips/new" element={<ProtectedRoute><TripWizardPage /></ProtectedRoute>} />
            <Route path="/dashboard/trips/:tripId" element={<ProtectedRoute><TripOverviewPage /></ProtectedRoute>} />
            <Route path="/dashboard/trips/:tripId/day/:dayId" element={<ProtectedRoute><TripDayPage /></ProtectedRoute>} />
            <Route
              path="/dashboard/trips/:tripId/day/:dayId/activity/:activityId"
              element={<ProtectedRoute><ActivityDetailPage /></ProtectedRoute>}
            />
          </Routes>
        </AuthBoot>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
