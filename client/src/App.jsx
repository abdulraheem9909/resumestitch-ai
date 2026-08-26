import { Navigate, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import ResumeBullets from './pages/ResumeBullets.jsx'
import MasterResumes from './pages/MasterResumes.jsx'
import JdSubmission from './pages/JdSubmission.jsx'
import Applications from './pages/Applications.jsx'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/bullets" replace />} />
          <Route path="/bullets" element={<ResumeBullets />} />
          <Route path="/resumes" element={<MasterResumes />} />
          <Route path="/resumes/:resumeId/apply" element={<JdSubmission />} />
          <Route path="/applications" element={<Applications />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
