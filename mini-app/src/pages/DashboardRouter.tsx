import { useState, useEffect } from 'react'
import { getMe } from '../api/client'
import type { UserOut } from '../shared/types'
import Dashboard from './Dashboard'
import TeacherDashboard from './TeacherDashboard'
import AdminDashboard from './AdminDashboard'
import TeacherOnboardingModal from '../components/TeacherOnboardingModal'

import { Loading } from '../shared/components'

export default function DashboardRouter() {
  const [user, setUser] = useState<UserOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTeacherOnboarding, setShowTeacherOnboarding] = useState(false)

  useEffect(() => {
    getMe()
      .then(u => {
        setUser(u)
        if ((u.role === 'teacher' || u.role === 'admin') && !u.onboarded) {
          setShowTeacherOnboarding(true)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
            getMe().then(setUser).catch(console.error)
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
