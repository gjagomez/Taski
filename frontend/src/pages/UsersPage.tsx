import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { Loader2, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Panel } from '@/components/AppLayout'
import { Loading, PageHeader, UserAvatar } from '@/components/common'
import { isStrong, PasswordStrength } from './auth/PasswordStrength'
import { CREATE_USER, ROLES, SEND_INVITATION, SET_USER_ACTIVE, UPDATE_USER_ROLE, USERS } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import { fmtDate, isEmail } from '@/lib/format'
import type { User, UserRole } from '@/lib/types'

export default function UsersPage() {
  const { user: me } = useAuth()
  const { data, loading } = useQuery<{ users: User[] }>(USERS)
  const { data: rolesData } = useQuery<{ roles: UserRole[] }>(ROLES)
  const roles = rolesData?.roles ?? []
  const [updateRole] = useMutation(UPDATE_USER_ROLE, { refetchQueries: ['Roles'] })
  const [setActive] = useMutation(SET_USER_ACTIVE)
  const [open, setOpen] = useState(false)
  const [inviting, setInviting] = useState<User | null>(null)

  const run = async (p: Promise<unknown>, msg: string) => {
    try {
      await p
      toast.success(msg)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Panel className="min-h-[calc(100vh-2.5rem)]">
      <PageHeader
        title="Usuarios"
        subtitle="Crea cuentas, asigna su rol y envía invitaciones. Los permisos de cada rol se configuran en Roles."
        actions={
          <Button className="rounded-full shadow-lg shadow-primary/30" onClick={() => setOpen(true)}>
            <UserPlus /> Nuevo usuario
          </Button>
        }
      />
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="mt-6 overflow-hidden rounded-3xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="pl-5">Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Registrado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="pr-5 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.users.map((u) => {
                const self = u.id === me?.id
                return (
                  <TableRow key={u.id} className={u.active ? '' : 'opacity-60'}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={u} className="size-9" />
                        <div>
                          <p className="font-semibold">{u.name} {self && <span className="text-xs text-muted-foreground">(tú)</span>}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleSelect
                        roles={roles}
                        current={u.role}
                        disabled={self}
                        onChange={(roleId) => run(updateRole({ variables: { id: u.id, roleId } }), 'Rol actualizado')}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="space-x-2 pr-5 text-right">
                      {!self && u.active && (
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setInviting(u)}>
                          <Mail /> Invitar
                        </Button>
                      )}
                      {!self && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => run(setActive({ variables: { id: u.id, active: !u.active } }), u.active ? 'Usuario desactivado' : 'Usuario activado')}
                        >
                          {u.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      )}
                      {self && <ShieldCheck className="ml-auto size-4 text-primary" />}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <CreateUserDialog open={open} onOpenChange={setOpen} roles={roles} />
      <InviteDialog user={inviting} onClose={() => setInviting(null)} />
    </Panel>
  )
}


function RoleSelect({
  roles,
  current,
  disabled,
  onChange,
  className = 'w-44',
}: {
  roles: UserRole[]
  current: UserRole | null
  disabled?: boolean
  onChange: (roleId: string) => void
  className?: string
}) {
  const options = current && !roles.some((r) => r.id === current.id) ? [current, ...roles] : roles
  return (
    <Select value={current?.id ?? ''} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Elige un rol" />
      </SelectTrigger>
      <SelectContent>
        {options.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            <span className="size-2.5 rounded-full" style={{ background: r.color }} />
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CreateUserDialog({ open, onOpenChange, roles }: { open: boolean; onOpenChange: (o: boolean) => void; roles: UserRole[] }) {

  const defaultRoleId = roles.find((r) => r.system && !r.locked)?.id ?? ''
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '' })
  const roleId = form.roleId || defaultRoleId
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState(true)
  const [create, { loading }] = useMutation<{ createUser: User }>(CREATE_USER, { refetchQueries: ['Users', 'Roles'] })
  const [sendInvitation, { loading: sending }] = useMutation<{ sendInvitation: EmailResult }>(SEND_INVITATION)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password || !roleId) return setError('Todos los campos son obligatorios')
    if (!isEmail(form.email)) return setError('Formato de correo inválido')
    if (!isStrong(form.password)) return setError('La contraseña no cumple los requisitos de seguridad')
    try {
      const { data } = await create({ variables: { ...form, roleId } })
      toast.success('Usuario creado')
      if (invite && data) {
        // El usuario ya existe aunque falle el correo: se avisa aparte y se puede reenviar desde la tabla
        sendInvitation({ variables: { userId: data.createUser.id, temporaryPassword: form.password } })
          .then(({ data: r }) => r && notifyEmail(r.sendInvitation))
          .catch((err) => toast.error(`No se pudo enviar la invitación: ${errorMessage(err)}`))
      }
      setForm({ name: '', email: '', password: '', roleId: '' })
      setError(null)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Nuevo usuario</DialogTitle>
          <DialogDescription>Crea una cuenta para un miembro del equipo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Correo *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña *</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <PasswordStrength password={form.password} />
          </div>
          <div className="space-y-1.5">
            <Label>Rol *</Label>
            <RoleSelect
              roles={roles}
              current={roles.find((r) => r.id === roleId) ?? null}
              onChange={(v) => setForm({ ...form, roleId: v })}
              className="w-full"
            />
          </div>
          <label className="flex items-start gap-3 rounded-2xl border bg-muted/30 p-3 text-sm">
            <Checkbox checked={invite} onCheckedChange={(v) => setInvite(v === true)} className="mt-0.5" />
            <span>
              <span className="font-semibold">Enviar invitación por correo</span>
              <span className="block text-xs text-muted-foreground">Incluye su correo, la contraseña temporal y los tableros donde participa.</span>
            </span>
          </label>
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="rounded-full" disabled={loading || sending}>
              {(loading || sending) && <Loader2 className="animate-spin" />} Crear usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type EmailResult = { sent: boolean; simulated: boolean; to: string; detail: string }

function notifyEmail(r: EmailResult) {
  if (r.sent) toast.success(`Invitación enviada a ${r.to}`)
  else toast.info(`Correo simulado (Mailjet sin configurar): ${r.detail}`)
}

function InviteDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [send, { loading }] = useMutation<{ sendInvitation: EmailResult }>(SEND_INVITATION)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    try {
      const { data } = await send({ variables: { userId: user.id, message: message.trim() || null } })
      if (data) notifyEmail(data.sendInvitation)
      setMessage('')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Enviar invitación</DialogTitle>
          <DialogDescription>
            {user?.name} recibirá en <strong>{user?.email}</strong> un correo con su rol, un enlace para entrar y los
            tableros (Nuevo, Billetera, PRONET…) y proyectos donde participa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Mensaje personal (opcional)</Label>
            <Textarea
              rows={4}
              maxLength={1000}
              placeholder="Ej.: Esta semana arrancamos con Pagos QR, revisa tus subtareas."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="rounded-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Mail />} Enviar correo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
