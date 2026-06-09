import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import Dashboard from './Dashboard'
import TeacherDashboard from './TeacherDashboard'
import AdminDashboard from './AdminDashboard'
import TeacherOnboardingModal from '../components/TeacherOnboardingModal'
import OnboardingModal from '../components/OnboardingModal'

import { Loading } from '../shared/components'

export default function DashboardRouter() {
  const navigate = useNavigate()
  const { user, loading, refresh } = useUser()
  const [showTeacherOnboarding, setShowTeacherOnboarding] = useState(false)
  const [showStudentOnboarding, setShowStudentOnboarding] = useState(false)

  // Check onboarding status after user data loads
  useEffect(() => {
    if (!user) return
    if ((user.role === 'teacher' || user.role === 'admin') && !user.onboarded) {
      setShowTeacherOnboarding(true)
    }
  }, [user])

  if (loading) {
    return <Loading fullPage />
  }

  if (!user) {
    return <div>Error loading</div>
  }

  // Student onboarding gate
  if (user.role === 'student' && !user.onboarded) {
    return (
      <OnboardingModal
        isOpen={true}
        onClose={() => {
          refresh()
        }}
      />
    )
  }

  if (showTeacherOnboarding) {
    return (
      <>
        <TeacherOnboardingModal
          isOpen={showTeacherOnboarding}
          onClose={() => {
            setShowTeacherOnboarding(false)
            refresh()
          }}
        />
        {user.role === 'admin' ? <AdminDashboard /> : <TeacherDashboard />}
      </>
    )
  }

  if (user.role === 'admin') {
    return <AdminDashboard />
  }

  if (user.role === 'teacher') {
    return <TeacherDashboard />
  }

  return <Dashboard />
}
