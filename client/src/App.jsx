import { Navigate, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import ResumeBullets from './pages/ResumeBullets.jsx'
import MasterResumes from './pages/MasterResumes.jsx'
import JdSubmission from './pages/JdSubmission.jsx'
import Applications from './pages/Applications.jsx'
import Approval from './pages/Approval.jsx'

function App() {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-6 pt-7 pb-10 md:px-10 md:pt-10 md:pb-14">
        <Routes>
          <Route path="/" element={<Navigate to="/bullets" replace />} />
          <Route path="/bullets" element={<ResumeBullets />} />
          <Route path="/resumes" element={<MasterResumes />} />
          <Route path="/resumes/:resumeId/apply" element={<JdSubmission />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/applications/:applicationId/approve" element={<Approval />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
