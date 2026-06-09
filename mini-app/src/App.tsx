import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import WebApp from '@twa-dev/sdk'
import ProtectedRoute from './components/ProtectedRoute'
import BottomNavBar from './components/BottomNavBar'
import { Loading } from './shared/components'
import './App.css'

// Lazy-loaded pages — каждый чанк загружается только при переходе
const Landing = lazy(() => import('./pages/Landing'))
const DashboardRouter = lazy(() => import('./pages/DashboardRouter'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Courses = lazy(() => import('./pages/Courses'))
const CourseDetail = lazy(() => import('./pages/CourseDetail'))
const LessonDetail = lazy(() => import('./pages/LessonDetail'))
const Announcements = lazy(() => import('./pages/Announcements'))
const AnnouncementDetail = lazy(() => import('./pages/AnnouncementDetail'))
const CreateAnnouncement = lazy(() => import('./pages/CreateAnnouncement'))
const Profile = lazy(() => import('./pages/Profile'))
const TeacherStudents = lazy(() => import('./pages/TeacherStudents'))
const TeacherStudentDetail = lazy(() => import('./pages/TeacherStudentDetail'))
const Home = lazy(() => import('./pages/Home'))
const TestDetail = lazy(() => import('./pages/TestDetail'))
const MyRegistrations = lazy(() => import('./pages/MyRegistrations'))
const MyResults = lazy(() => import('./pages/MyResults'))
const AdminPeople = lazy(() => import('./pages/AdminPeople'))
const AdminUserProfile = lazy(() => import('./pages/AdminUserProfile'))
const AdminCourses = lazy(() => import('./pages/AdminCourses'))
const AdminCourseDetail = lazy(() => import('./pages/AdminCourseDetail'))
const AdminLessonDetail = lazy(() => import('./pages/AdminLessonDetail'))
const AdminAnnouncements = lazy(() => import('./pages/AdminAnnouncements'))
const AdminAnnouncementDetail = lazy(() => import('./pages/AdminAnnouncementDetail'))
const AdminCalendar = lazy(() => import('./pages/AdminCalendar'))
const AdminMore = lazy(() => import('./pages/AdminMore'))
const NotFound = lazy(() => import('./pages/NotFound'))

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
      <Suspense fallback={<Loading fullPage />}>
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
      </Suspense>
      <BottomNavBar />
    </>
  )
}

export default App
