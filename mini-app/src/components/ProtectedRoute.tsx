import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { Loading } from '../shared/components'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: string[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useUser()
  const location = useLocation()

  if (loading) {
    return <Loading fullPage />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  // Block non-onboarded students from accessing protected routes
  // (teachers/admins are handled by DashboardRouter)
  if (!user.onboarded && user.role === 'student' && location.pathname !== '/dashboard') {
    return <Navigate to="/" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
