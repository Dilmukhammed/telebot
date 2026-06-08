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
        <Route path="/dashboard" element={<DashboardRouter />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/course/:id" element={<CourseDetail />} />
        <Route path="/lesson/:id" element={<LessonDetail />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/announcement/:id" element={<AnnouncementDetail />} />
        <Route path="/announcements/create" element={<CreateAnnouncement />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/teacher/students" element={<TeacherStudents />} />
        <Route path="/teacher/students/:id" element={<TeacherStudentDetail />} />
        <Route path="/tests" element={<Home />} />
        <Route path="/test/:id" element={<TestDetail />} />
        <Route path="/registrations" element={<MyRegistrations />} />
        <Route path="/results" element={<MyResults />} />
        {/* Admin routes */}
        <Route path="/admin/people" element={<AdminPeople />} />
        <Route path="/admin/people/:id" element={<AdminUserProfile />} />
        <Route path="/admin/courses" element={<AdminCourses />} />
        <Route path="/admin/courses/:id" element={<AdminCourseDetail />} />
        <Route path="/admin/lessons/:id" element={<AdminLessonDetail />} />
        <Route path="/admin/announcements" element={<AdminAnnouncements />} />
        <Route path="/admin/announcements/:id" element={<AdminAnnouncementDetail />} />
        <Route path="/admin/calendar" element={<AdminCalendar />} />
        <Route path="/admin/more" element={<AdminMore />} />
      </Routes>
      <BottomNavBar />
    </>
  )
}

export default App