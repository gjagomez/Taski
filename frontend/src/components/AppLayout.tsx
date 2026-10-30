import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Box,
  FolderKanban,
  History,
  KeyRound,
  ListTodo,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Logo, UserAvatar } from '@/components/common'
import { StairsIllustration } from '@/components/Illustration'
import { WorkspaceNav } from '@/components/workspace/WorkspaceNav'
import { AiAssistant } from '@/components/ai/AiAssistant'
import { useAuth } from '@/lib/auth'
import { FEATURES } from '@/lib/features'
import { cn } from '@/lib/utils'

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, can, signOut } = useAuth()
  const navigate = useNavigate()

  const main = [
    { to: '/', label: 'Dashboard', icon: Box, end: true },
    ...(FEATURES.kanban ? [{ to: '/kanban', label: 'Tableros Kanban', icon: FolderKanban }] : []),
    { to: '/mis-tareas', label: 'Mis tareas', icon: ListTodo },
  ]
  const insights = [
    { to: '/actividad', label: 'Actividad', icon: History },
    ...(can('users.manage') ? [{ to: '/usuarios', label: 'Usuarios', icon: Users }] : []),
    ...(can('roles.manage') ? [{ to: '/roles', label: 'Roles', icon: KeyRound }] : []),
  ]

  const link = ({ to, label, icon: Icon, end }: (typeof main)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
          isActive
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
            : 'text-muted-foreground hover:bg-white/70 hover:text-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="size-[18px]" />
          <span className="flex-1">{label}</span>
          {isActive && <ArrowRight className="size-4" />}
        </>
      )}
    </NavLink>
  )

  return (
    <div className="flex h-full flex-col gap-6 px-4 py-7">
      <Logo className="px-2" />
      <div className="scrollbar-thin -mx-1 min-h-0 flex-1 space-y-6 overflow-y-auto px-1">
        <nav className="space-y-1">{main.map(link)}</nav>
        <WorkspaceNav onNavigate={onNavigate} />
        <div>
          <p className="mb-2 px-4 text-xs font-medium text-muted-foreground/80">Insights</p>
          <nav className="space-y-1">{insights.map(link)}</nav>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative hidden overflow-hidden rounded-3xl bg-white px-4 pt-2 pb-4 text-center shadow-xl shadow-primary/10 [@media(min-height:960px)]:block">
          <StairsIllustration className="mx-auto h-24" />
          <p className="text-sm font-semibold">Calidad desde el diseño</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Trazabilidad en cada tarea</p>
        </div>
        {user && (
          <div className="flex items-center gap-3 rounded-2xl bg-white/60 p-2.5">
            <UserAvatar user={user} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3" style={{ color: user.role.color }} />
                <span className="truncate">{user.role.name}</span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Cerrar sesión"
              onClick={() => {
                signOut()
                navigate('/login')
              }}
            >
              <LogOut />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function AppLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        <Nav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-4 py-3 lg:hidden">
          <Logo />
          <Button variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu />
          </Button>
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 bg-background p-0">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            <Nav onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="flex-1 p-2 sm:p-4 lg:py-5 lg:pr-5 lg:pl-0">
          <Outlet />
        </main>
        <AiAssistant />
      </div>
    </div>
  )
}

/** Panel blanco redondeado principal, como en la UI de referencia. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-[2rem] bg-white/90 p-5 shadow-2xl shadow-primary/10 backdrop-blur sm:p-8', className)}>
      {children}
    </div>
  )
}
