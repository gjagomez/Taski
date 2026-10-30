import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { AlertTriangle, KeyRound, Loader2, Lock, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/AppLayout'
import { Loading, PageHeader } from '@/components/common'
import { CREATE_ROLE, DELETE_ROLE, PERMISSIONS, ROLES, UPDATE_ROLE } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import type { Permission, PermissionInfo, UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

const COLORS = ['#6d5df6', '#579bfc', '#00c875', '#037f4c', '#fdab3d', '#f45b69', '#a25ddc', '#ff7575']


export default function RolesPage() {
  const { data, loading } = useQuery<{ roles: UserRole[] }>(ROLES)
  const { data: permData } = useQuery<{ permissions: PermissionInfo[] }>(PERMISSIONS)
  const catalog = permData?.permissions ?? []
  // null = cerrado; 'new' = crear; un rol = editar
  const [editing, setEditing] = useState<UserRole | 'new' | null>(null)
  const [deleting, setDeleting] = useState<UserRole | null>(null)

  return (
    <Panel className="min-h-[calc(100vh-2.5rem)]">
      <PageHeader
        title="Roles"
        subtitle="Define qué puede hacer cada persona. Los cambios se aplican al instante a todos los usuarios con ese rol."
        actions={
          <Button className="rounded-full shadow-lg shadow-primary/30" onClick={() => setEditing('new')}>
            <Plus /> Nuevo rol
          </Button>
        }
      />
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.roles.map((role) => (
            <RoleCard key={role.id} role={role} catalog={catalog} onEdit={() => setEditing(role)} onDelete={() => setDeleting(role)} />
          ))}
        </div>
      )}
      {editing && (
        <RoleDialog key={editing === 'new' ? 'new' : editing.id} role={editing === 'new' ? null : editing} catalog={catalog} onClose={() => setEditing(null)} />
      )}
      <DeleteRoleDialog role={deleting} onClose={() => setDeleting(null)} />
    </Panel>
  )
}

function RoleCard({ role, catalog, onEdit, onDelete }: { role: UserRole; catalog: PermissionInfo[]; onEdit: () => void; onDelete: () => void }) {
  const perms = role.permissions ?? []
  const labels = catalog.filter((p) => perms.includes(p.key)).map((p) => p.label)
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border bg-white">
      <div className="h-1.5" style={{ background: role.color }} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: role.color }}>
            <KeyRound className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-lg font-bold">{role.name}</p>
              {role.system && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  <Lock className="size-3" /> Sistema
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-sm text-muted-foreground">{role.description || 'Sin descripción'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-4" /> {role.userCount} usuario{role.userCount === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <KeyRound className="size-4" /> {perms.length} de {catalog.length || perms.length} permisos
          </span>
        </div>

        <div className="flex flex-1 flex-wrap content-start gap-1.5">
          {labels.length ? (
            labels.map((l) => (
              <span key={l} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {l}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">
              Sin permisos especiales: trabaja solo en los proyectos donde está asignado.
            </span>
          )}
        </div>

        <div className="flex gap-2 border-t pt-4">
          <Button variant="outline" size="sm" className="rounded-full" onClick={onEdit}>
            <Pencil /> Editar
          </Button>
          {!role.system && (
            <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 /> Eliminar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function RoleDialog({ role, catalog, onClose }: { role: UserRole | null; catalog: PermissionInfo[]; onClose: () => void }) {
  const { can, user, refreshUser } = useAuth()
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [color, setColor] = useState(role?.color ?? COLORS[0])
  const [perms, setPerms] = useState<Set<Permission>>(new Set(role?.permissions ?? []))
  const [error, setError] = useState<string | null>(null)
  const opts = { refetchQueries: ['Roles', 'Users'] }
  const [create, { loading: creating }] = useMutation(CREATE_ROLE, opts)
  const [update, { loading: updating }] = useMutation(UPDATE_ROLE, opts)
  const saving = creating || updating
  const ownRole = !!role && user?.role.id === role.id

  const groups = [...new Set(catalog.map((p) => p.group))]
  const toggle = (key: Permission) => {
    const next = new Set(perms)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setPerms(next)
  }
 
  const lockReason = (key: Permission) => {
    if (role?.locked) return 'El Administrador siempre tiene todos los permisos'
    if (!can(key)) return 'No puedes otorgar un permiso que tú no tienes'
    if (ownRole && key === 'roles.manage') return 'Es tu rol: perderías el acceso a esta pantalla'
    return null
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('El nombre es obligatorio')
    const input = { name: name.trim(), description: description.trim() || null, color, permissions: [...perms] }
    try {
      if (role) await update({ variables: { id: role.id, input } })
      else await create({ variables: { input } })
      if (ownRole) await refreshUser()
      toast.success(role ? `Rol "${input.name}" actualizado` : `Rol "${input.name}" creado`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{role ? `Editar rol "${role.name}"` : 'Nuevo rol'}</DialogTitle>
          <DialogDescription>
            {role?.system
              ? 'Es un rol del sistema: no se puede renombrar ni eliminar.'
              : 'Ponle un nombre claro y marca solo los permisos que necesita.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Nombre *</Label>
              <Input id="role-name" maxLength={60} value={name} disabled={role?.system} placeholder="Ej.: Líder técnico" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex h-9 items-center gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => setColor(c)}
                    className={cn('size-6 rounded-full ring-offset-2 transition', color === c ? 'ring-2 ring-foreground/70' : 'hover:scale-110')}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-desc">Descripción</Label>
            <Textarea id="role-desc" rows={2} maxLength={255} value={description} placeholder="¿Para quién es este rol?" onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Permisos</Label>
              <span className="text-xs text-muted-foreground">
                {perms.size} de {catalog.length} seleccionados
              </span>
            </div>
            {groups.map((group) => (
              <div key={group} className="overflow-hidden rounded-2xl border">
                <p className="bg-muted/50 px-4 py-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{group}</p>
                <div className="divide-y">
                  {catalog
                    .filter((p) => p.group === group)
                    .map((p) => {
                      const reason = lockReason(p.key)
                      return (
                        <label
                          key={p.key}
                          className={cn('flex items-start gap-3 px-4 py-3', reason ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-muted/30')}
                        >
                          <Checkbox className="mt-0.5" checked={perms.has(p.key)} disabled={!!reason} onCheckedChange={() => toggle(p.key)} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{p.label}</span>
                            <span className="block text-xs text-muted-foreground">{p.description}</span>
                            {reason && <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="size-3" /> {reason}</span>}
                          </span>
                        </label>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="rounded-full" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} {role ? 'Guardar cambios' : 'Crear rol'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteRoleDialog({ role, onClose }: { role: UserRole | null; onClose: () => void }) {
  const [remove, { loading }] = useMutation(DELETE_ROLE, { refetchQueries: ['Roles'] })
  const inUse = (role?.userCount ?? 0) > 0

  async function confirm() {
    if (!role) return
    try {
      await remove({ variables: { id: role.id } })
      toast.success(`Rol "${role.name}" eliminado`)
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <div className={`mb-2 grid size-12 place-items-center rounded-2xl ${inUse ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
            {inUse ? <AlertTriangle className="size-6" /> : <Trash2 className="size-6" />}
          </div>
          <DialogTitle className="text-xl">{inUse ? 'El rol está en uso' : `¿Eliminar "${role?.name}"?`}</DialogTitle>
          <DialogDescription>
            {inUse
              ? `${role?.userCount} usuario(s) tienen el rol "${role?.name}". Cámbiales el rol en Usuarios antes de eliminarlo.`
              : 'Esta acción no se puede deshacer.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{inUse ? 'Entendido' : 'Cancelar'}</Button>
          {!inUse && (
            <Button variant="destructive" className="rounded-full" disabled={loading} onClick={confirm}>
              {loading && <Loader2 className="animate-spin" />} Eliminar rol
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
