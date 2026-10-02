import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Sidebar from './components/Sidebar.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import ResumeBullets from './pages/ResumeBullets.jsx'
import MasterResumes from './pages/MasterResumes.jsx'
import ResumeDetail from './pages/ResumeDetail.jsx'
import Apply from './pages/Apply.jsx'
import Applications from './pages/Applications.jsx'
import Approval from './pages/Approval.jsx'
import Profile from './pages/Profile.jsx'
import OutreachTracker from './pages/OutreachTracker.jsx'
import OutreachCompanyDetail from './pages/OutreachCompanyDetail.jsx'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="flex h-svh flex-col overflow-hidden md:flex-row">
                <Sidebar />
                <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-10 md:px-10 md:pb-14">
                  <Routes>
                    <Route path="/" element={<Navigate to="/applications" replace />} />
                    <Route path="/applications" element={<Applications />} />
                    <Route path="/applications/:applicationId/approve" element={<Approval />} />
                    <Route path="/apply" element={<Apply />} />
                    <Route path="/resumes" element={<MasterResumes />} />
                    <Route path="/resumes/:id" element={<ResumeDetail />} />
                    <Route path="/resumes/:id/bullets" element={<ResumeBullets />} />
                    <Route path="/outreach" element={<OutreachTracker />} />
                    <Route path="/outreach/:id" element={<OutreachCompanyDetail />} />
                    <Route path="/profile" element={<Profile />} />
                  </Routes>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}

export default App
