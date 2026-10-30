import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client/react'
import { ArrowLeft, ArrowRight, Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout, FieldError } from './AuthLayout'
import { isStrong, PasswordStrength } from './PasswordStrength'
import { CodeInput } from './CodeInput'
import { CONFIRM_REGISTRATION, REGISTER } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import { isEmail } from '@/lib/format'
import type { User } from '@/lib/types'

type CodeInfo = { message: string; devCode: string | null }

export default function Register() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [params] = useSearchParams()
  const linkEmail = params.get('email') ?? ''
  const linkCode = /^\d{6}$/.test(params.get('code') ?? '') ? params.get('code')! : ''
  const [step, setStep] = useState<'form' | 'code'>(linkEmail && linkCode ? 'code' : 'form')
  const [form, setForm] = useState({ name: '', email: linkEmail, password: '', confirm: '' })
  const [code, setCode] = useState(linkCode)
  const [cooldown, setCooldown] = useState(0)
  const [info, setInfo] = useState<CodeInfo | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [register, { loading }] = useMutation<{ register: CodeInfo }>(REGISTER)
  const [confirmRegistration, { loading: confirming }] = useMutation<{ confirmRegistration: { token: string; user: User } }>(
    CONFIRM_REGISTRATION
  )
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })


  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'El nombre es obligatorio'
    if (!form.email.trim()) next.email = 'El correo es obligatorio'
    else if (!isEmail(form.email)) next.email = 'Formato de correo inválido'
    if (!form.password) next.password = 'La contraseña es obligatoria'
    else if (!isStrong(form.password)) next.password = 'La contraseña no cumple los requisitos de seguridad'
    if (form.confirm !== form.password) next.confirm = 'Las contraseñas no coinciden'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      const { data } = await register({ variables: { name: form.name, email: form.email, password: form.password } })
      setInfo(data!.register)
      setCooldown(60)
      if (step === 'code') toast.success('Te enviamos un código nuevo.')
      setStep('code')
    } catch (err) {
      setErrors({ form: errorMessage(err) })
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) return setErrors({ code: 'Completa los 6 dígitos del código' })
    setErrors({})
    try {
      const { data } = await confirmRegistration({ variables: { email: form.email, code } })
      signIn(data!.confirmRegistration.token, data!.confirmRegistration.user)
      navigate('/')
    } catch (err) {
      setErrors({ form: errorMessage(err) })
    }
  }

  
  const canResend = !!form.password

  return (
    <AuthLayout
      title={step === 'form' ? 'Crea tu cuenta' : 'Confirma tu correo'}
      subtitle={step === 'form' ? 'Únete a tu equipo y empieza a colaborar en los tableros.' : 'Ingresa el código que te enviamos para crear tu cuenta.'}
    >
      {step === 'form' ? (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo</Label>
            <Input id="name" className="h-11 rounded-xl" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
            <FieldError>{errors.name}</FieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" className="h-11 rounded-xl" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} />
            <FieldError>{errors.email}</FieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" className="h-11 rounded-xl" value={form.password} onChange={set('password')} aria-invalid={!!errors.password} />
            <PasswordStrength password={form.password} />
            <FieldError>{errors.password}</FieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <Input id="confirm" type="password" className="h-11 rounded-xl" value={form.confirm} onChange={set('confirm')} aria-invalid={!!errors.confirm} />
            <FieldError>{errors.confirm}</FieldError>
          </div>
          {errors.form && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{errors.form}</div>
          )}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <>Crear cuenta <ArrowRight /></>}
          </Button>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-5" noValidate>
          <div className="flex gap-3 rounded-2xl bg-secondary/70 p-4 text-sm text-secondary-foreground">
            <MailCheck className="size-5 shrink-0" />
            <div>
              <p>{info ? info.message : <>Confirmando el correo <b>{form.email}</b>.</>}</p>
              {info?.devCode && (
                <p className="mt-1 text-xs">
                  Modo desarrollo (correo no enviado) — tu código es <b className="font-mono text-base">{info.devCode}</b>
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="code">Código de verificación</Label>
              {canResend && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:text-muted-foreground"
                  disabled={loading || cooldown > 0}
                  onClick={() => sendCode()}
                >
                  {cooldown > 0 ? `Reenviar código (${cooldown} s)` : 'Reenviar código'}
                </button>
              )}
            </div>
            <CodeInput value={code} onChange={setCode} invalid={!!errors.code} autoFocus={!linkCode} />
            <FieldError>{errors.code}</FieldError>
          </div>
          {errors.form && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{errors.form}</div>}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={confirming}>
            {confirming ? <Loader2 className="animate-spin" /> : 'Confirmar y crear cuenta'}
          </Button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            onClick={() => {
              setStep('form')
              setCode('')
              setErrors({})
            }}
          >
            <ArrowLeft className="size-4" /> Cambiar mis datos
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
