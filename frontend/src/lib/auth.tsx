import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { client, getToken, TOKEN_KEY } from './apollo'
import { ME } from './graphql'
import type { Permission, User } from './types'

interface AuthState {
  user: User | null
  loading: boolean
  /** El usuario tiene el permiso (la regla real la valida el servidor) */
  can: (permission: Permission) => boolean
  signIn: (token: string, user: User) => void
  /** Vuelve a leer el usuario (por ejemplo, tras cambiar los permisos de su propio rol) */
  refreshUser: () => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    client
      .query<{ me: User | null }>({ query: ME, fetchPolicy: 'network-only' })
      .then(({ data }) => {
        if (data?.me) setUser(data.me)
        else localStorage.removeItem(TOKEN_KEY)
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const signIn = (token: string, next: User) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* almacenamiento no disponible */
    }
    setUser(next)
  }

  const refreshUser = async () => {
    const { data } = await client.query<{ me: User | null }>({ query: ME, fetchPolicy: 'network-only' })
    if (data?.me) setUser(data.me)
  }

  const signOut = () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* almacenamiento no disponible */
    }
    setUser(null)
    client.clearStore()
  }

  return (
    <AuthContext.Provider value={{ user, loading, can: (p) => !!user?.permissions.includes(p), signIn, refreshUser, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

/** Sin el permiso "Asignar a otras personas" solo puede asignarse a sí mismo. */
export function useAssignRestriction() {
  const { user, can } = useAuth()
  return user && !can('projects.assignOthers') ? user.id : undefined
}
