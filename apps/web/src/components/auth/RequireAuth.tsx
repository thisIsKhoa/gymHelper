import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { getAuthToken } from '../../lib/api.ts'

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation()
  const token = getAuthToken()

  if (!token) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
