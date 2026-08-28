import { Navigate, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import ResumeBullets from './pages/ResumeBullets.jsx'
import MasterResumes from './pages/MasterResumes.jsx'
import ResumeDetail from './pages/ResumeDetail.jsx'
import Apply from './pages/Apply.jsx'
import Applications from './pages/Applications.jsx'
import Approval from './pages/Approval.jsx'

function App() {
  return (
    <div className="flex h-svh flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-6 pb-10 md:px-10 md:pb-14">
        <Routes>
          <Route path="/" element={<Navigate to="/applications" replace />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/applications/:applicationId/approve" element={<Approval />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/resumes" element={<MasterResumes />} />
          <Route path="/resumes/:id" element={<ResumeDetail />} />
          <Route path="/resumes/:id/bullets" element={<ResumeBullets />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
