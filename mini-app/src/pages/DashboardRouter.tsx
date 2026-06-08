import { useState } from 'react'
import { useUser } from '../context/UserContext'
import Dashboard from './Dashboard'
import TeacherDashboard from './TeacherDashboard'
import AdminDashboard from './AdminDashboard'
import TeacherOnboardingModal from '../components/TeacherOnboardingModal'

import { Loading } from '../shared/components'

export default function DashboardRouter() {
  const { user, loading, refresh } = useUser()
  const [showTeacherOnboarding, setShowTeacherOnboarding] = useState(
    () => !!user && (user.role === 'teacher' || user.role === 'admin') && !user.onboarded
  )

  if (loading) {
    return <Loading fullPage />
  }

  if (!user) {
    return <div>Error loading</div>
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
