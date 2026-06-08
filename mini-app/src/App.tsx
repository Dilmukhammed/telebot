import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import WebApp from '@twa-dev/sdk'
import Landing from './pages/Landing'
import DashboardRouter from './pages/DashboardRouter'
import Calendar from './pages/Calendar'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import LessonDetail from './pages/LessonDetail'
import Announcements from './pages/Announcements'
import AnnouncementDetail from './pages/AnnouncementDetail'
import CreateAnnouncement from './pages/CreateAnnouncement'
import Profile from './pages/Profile'
import TeacherStudents from './pages/TeacherStudents'
import TeacherStudentDetail from './pages/TeacherStudentDetail'
import Home from './pages/Home'
import TestDetail from './pages/TestDetail'
import MyRegistrations from './pages/MyRegistrations'
import MyResults from './pages/MyResults'
import AdminPeople from './pages/AdminPeople'
import AdminUserProfile from './pages/AdminUserProfile'
import AdminCourses from './pages/AdminCourses'
import AdminCourseDetail from './pages/AdminCourseDetail'
import AdminLessonDetail from './pages/AdminLessonDetail'
import AdminAnnouncements from './pages/AdminAnnouncements'
import AdminAnnouncementDetail from './pages/AdminAnnouncementDetail'
import AdminCalendar from './pages/AdminCalendar'
import AdminMore from './pages/AdminMore'
import NotFound from './pages/NotFound'
import ProtectedRoute from './components/ProtectedRoute'
import BottomNavBar from './components/BottomNavBar'
import './App.css'

function BackButtonHandler() {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/' || location.pathname === '/dashboard'

  useEffect(() => {
    try { WebApp.enableClosingConfirmation() } catch {}

    if (isHome) {
      try { WebApp.BackButton.hide() } catch {}
      return
    }

    const handleBack = () => {
      navigate(-1)
    }

    try {
      WebApp.BackButton.show()
      WebApp.BackButton.onClick(handleBack)
    } catch {}

    return () => {
      try {
        WebApp.BackButton.offClick(handleBack)
        WebApp.BackButton.hide()
      } catch {}
    }
  }, [isHome, navigate])

  return null
}

function App() {
  return (
    <>
      <BackButtonHandler />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
        <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
        <Route path="/course/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
        <Route path="/lesson/:id" element={<ProtectedRoute><LessonDetail /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
        <Route path="/announcement/:id" element={<ProtectedRoute><AnnouncementDetail /></ProtectedRoute>} />
        <Route path="/announcements/create" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><CreateAnnouncement /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/teacher/students" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><TeacherStudents /></ProtectedRoute>} />
        <Route path="/teacher/students/:id" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><TeacherStudentDetail /></ProtectedRoute>} />
        <Route path="/tests" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/test/:id" element={<ProtectedRoute><TestDetail /></ProtectedRoute>} />
        <Route path="/registrations" element={<ProtectedRoute><MyRegistrations /></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute><MyResults /></ProtectedRoute>} />
        {/* Admin routes */}
        <Route path="/admin/people" element={<ProtectedRoute allowedRoles={['admin']}><AdminPeople /></ProtectedRoute>} />
        <Route path="/admin/people/:id" element={<ProtectedRoute allowedRoles={['admin']}><AdminUserProfile /></ProtectedRoute>} />
        <Route path="/admin/courses" element={<ProtectedRoute allowedRoles={['admin']}><AdminCourses /></ProtectedRoute>} />
        <Route path="/admin/courses/:id" element={<ProtectedRoute allowedRoles={['admin']}><AdminCourseDetail /></ProtectedRoute>} />
        <Route path="/admin/lessons/:id" element={<ProtectedRoute allowedRoles={['admin']}><AdminLessonDetail /></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnnouncements /></ProtectedRoute>} />
        <Route path="/admin/announcements/:id" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnnouncementDetail /></ProtectedRoute>} />
        <Route path="/admin/calendar" element={<ProtectedRoute allowedRoles={['admin']}><AdminCalendar /></ProtectedRoute>} />
        <Route path="/admin/more" element={<ProtectedRoute allowedRoles={['admin']}><AdminMore /></ProtectedRoute>} />
        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNavBar />
    </>
  )
}

export default App