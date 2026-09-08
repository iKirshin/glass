import { useEffect, useState } from 'react'
import { UserProfile, LOCAL_USER, getUserProfile } from './api'

// InPro runs locally with a single user; this hook only loads the display name.
export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getUserProfile()
      .then(profile => { if (!cancelled) setUser({ ...LOCAL_USER, ...profile }) })
      .catch(() => { if (!cancelled) setUser(LOCAL_USER) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { user, isLoading, mode: 'local' as const }
}

export const useRedirectIfNotAuth = () => {
  const { user } = useAuth()
  return user
}
