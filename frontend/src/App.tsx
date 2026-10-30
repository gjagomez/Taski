import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { Loading } from '@/components/common'
import { useAuth } from '@/lib/auth'
import { FEATURES } from '@/lib/features'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import DashboardPage from '@/pages/DashboardPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import BoardPage from '@/pages/BoardPage'
import MyTasksPage from '@/pages/MyTasksPage'
import ActivityPage from '@/pages/ActivityPage'
import UsersPage from '@/pages/UsersPage'
import RolesPage from '@/pages/RolesPage'
import type { Permission } from '@/lib/types'
import WsBoardPage, { WsHome } from '@/pages/WsBoardPage'
import ProjectKanbanPage from '@/pages/ProjectKanbanPage'

function RequireAuth({ children, permission }: { children: ReactNode; permission?: Permission }) {
  const { user, loading, can } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (permission && !can(permission)) return <Navigate to="/" replace />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/registro" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/recuperar" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="proyectos" element={<WsHome />} />
        <Route path="proyectos/:id" element={<WsBoardPage />} />
        <Route path="proyectos/:boardId/p/:itemId" element={<ProjectKanbanPage />} />
        {FEATURES.kanban && (
          <>
            <Route path="kanban" element={<ProjectsPage />} />
            <Route path="kanban/:id" element={<ProjectDetailPage />} />
            <Route path="tableros/:id" element={<BoardPage />} />
          </>
        )}
        <Route path="mis-tareas" element={<MyTasksPage />} />
        <Route path="actividad" element={<ActivityPage />} />
        <Route path="usuarios" element={<RequireAuth permission="users.manage"><UsersPage /></RequireAuth>} />
        <Route path="roles" element={<RequireAuth permission="roles.manage"><RolesPage /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
