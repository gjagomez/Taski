import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client/react'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout, FieldError } from './AuthLayout'
import { LOGIN } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import { isEmail } from '@/lib/format'
import type { User } from '@/lib/types'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [login, { loading }] = useMutation<{ login: { token: string; user: User } }>(LOGIN)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!email.trim()) next.email = 'El correo es obligatorio'
    else if (!isEmail(email)) next.email = 'Formato de correo inválido'
    if (!password) next.password = 'La contraseña es obligatoria'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      const { data } = await login({ variables: { email, password } })
      signIn(data!.login.token, data!.login.user)
      navigate('/')
    } catch (err) {
      setErrors({ form: errorMessage(err) })
    }
  }

  return (
    <AuthLayout title="Bienvenido de nuevo" subtitle="Inicia sesión para continuar con tus proyectos.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@correo.com"
            className="h-11 rounded-xl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
          />
          <FieldError>{errors.email}</FieldError>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link to="/recuperar" className="text-xs font-medium text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              placeholder="••••••••"
              className="h-11 rounded-xl pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
              aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FieldError>{errors.password}</FieldError>
        </div>
        {errors.form && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{errors.form}</div>
        )}
        <Button type="submit" className="h-11 w-full rounded-xl text-sm" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <>Iniciar sesión <ArrowRight /></>}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{' '}
        <Link to="/registro" className="font-semibold text-primary hover:underline">
          Regístrate
        </Link>
      </p>

      <div className="mt-8 rounded-2xl bg-secondary/60 p-4 text-xs text-secondary-foreground">
       
      </div>
    </AuthLayout>
  )
}
