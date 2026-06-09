import { useState, useEffect, useRef } from 'react'
import { useUser } from '../context/UserContext'
import Dashboard from './Dashboard'
import TeacherDashboard from './TeacherDashboard'
import AdminDashboard from './AdminDashboard'
import TeacherOnboardingModal from '../components/TeacherOnboardingModal'
import OnboardingModal from '../components/OnboardingModal'
import { Loading } from '../shared/components'

export default function DashboardRouter() {
  const { user, loading, refresh } = useUser()
  const [showTeacherOnboarding, setShowTeacherOnboarding] = useState(false)
  // Track if we've already determined onboarding is needed (prevents race condition with refresh)
  const onboardingCheckDone = useRef(false)

  // Check onboarding status after user data loads
  useEffect(() => {
    if (!user || onboardingCheckDone.current) return
    if ((user.role === 'teacher' || user.role === 'admin') && !user.onboarded) {
      setShowTeacherOnboarding(true)
      onboardingCheckDone.current = true
    }
  }, [user])

  if (loading) {
    return <Loading fullPage />
  }

  if (!user) {
    return <div>Error loading</div>
  }

  // Student onboarding gate — show only the modal, no dashboard behind it
  if (user.role === 'student' && !user.onboarded) {
    return (
      <OnboardingModal
        isOpen={true}
        onClose={() => refresh()}
      />
    )
  }

  // Teacher/admin onboarding — show only the modal, no dashboard behind it
  if (showTeacherOnboarding) {
    return (
      <TeacherOnboardingModal
        isOpen={showTeacherOnboarding}
        onClose={() => {
          setShowTeacherOnboarding(false)
          onboardingCheckDone.current = true
          refresh()
        }}
      />
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
