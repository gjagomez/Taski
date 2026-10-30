import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client/react'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout, FieldError } from './AuthLayout'
import { isStrong, PasswordStrength } from './PasswordStrength'
import { CodeInput } from './CodeInput'
import { REQUEST_RESET, RESET_PASSWORD } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { isEmail } from '@/lib/format'

export default function ForgotPassword() {
  const navigate = useNavigate()
  // El botón del correo trae ?email=…&code=… y abre directo el paso de la nueva contraseña
  const [params] = useSearchParams()
  const linkEmail = params.get('email') ?? ''
  const linkCode = /^\d{6}$/.test(params.get('code') ?? '') ? params.get('code')! : ''
  const [step, setStep] = useState<'email' | 'reset'>(linkEmail && linkCode ? 'reset' : 'email')
  const [email, setEmail] = useState(linkEmail)
  const [code, setCode] = useState(linkCode)
  const [cooldown, setCooldown] = useState(0)
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState<{ message: string; devCode: string | null } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [requestReset, { loading: requesting }] = useMutation<{ requestPasswordReset: { message: string; devCode: string | null } }>(REQUEST_RESET)
  const [resetPassword, { loading: resetting }] = useMutation(RESET_PASSWORD)

  // El servidor envía como máximo un código por minuto
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    if (!isEmail(email)) return setErrors({ email: 'Ingresa un correo válido' })
    setErrors({})
    try {
      const { data } = await requestReset({ variables: { email } })
      setInfo(data!.requestPasswordReset)
      setCooldown(60)
      if (step === 'reset') toast.success('Si el correo está registrado, te enviamos un código nuevo.')
      setStep('reset')
    } catch (err) {
      setErrors({ form: errorMessage(err) })
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!/^\d{6}$/.test(code)) next.code = 'Completa los 6 dígitos del código'
    if (!isStrong(password)) next.password = 'La contraseña no cumple los requisitos'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await resetPassword({ variables: { email, code, newPassword: password } })
      toast.success('Contraseña actualizada. Ya puedes iniciar sesión.')
      navigate('/login')
    } catch (err) {
      setErrors({ form: errorMessage(err) })
    }
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle={step === 'email' ? 'Te enviaremos un código de verificación.' : 'Ingresa el código y tu nueva contraseña.'}
    >
      {step === 'email' ? (
        <form onSubmit={sendCode} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" className="h-11 rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
            <FieldError>{errors.email}</FieldError>
          </div>
          {errors.form && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{errors.form}</div>}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={requesting}>
            {requesting ? <Loader2 className="animate-spin" /> : 'Enviar código'}
          </Button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-5" noValidate>
          {info && (
            <div className="flex gap-3 rounded-2xl bg-secondary/70 p-4 text-sm text-secondary-foreground">
              <MailCheck className="size-5 shrink-0" />
              <div>
                <p>{info.message}</p>
                {info.devCode && (
                  <p className="mt-1 text-xs">
                    Modo desarrollo (correo no enviado) — tu código es <b className="font-mono text-base">{info.devCode}</b>
                  </p>
                )}
              </div>
            </div>
          )}
          {!info && (
            <div className="flex gap-3 rounded-2xl bg-secondary/70 p-4 text-sm text-secondary-foreground">
              <MailCheck className="size-5 shrink-0" />
              <p>Recuperando la contraseña de <b>{email}</b>. Elige tu nueva contraseña.</p>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="code">Código de verificación</Label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:text-muted-foreground"
                disabled={requesting || cooldown > 0}
                onClick={() => sendCode()}
              >
                {cooldown > 0 ? `Reenviar código (${cooldown} s)` : 'Reenviar código'}
              </button>
            </div>
            <CodeInput value={code} onChange={setCode} invalid={!!errors.code} autoFocus={!linkCode} />
            <FieldError>{errors.code}</FieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input id="password" type="password" className="h-11 rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
            <PasswordStrength password={password} />
            <FieldError>{errors.password}</FieldError>
          </div>
          {errors.form && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{errors.form}</div>}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={resetting}>
            {resetting ? <Loader2 className="animate-spin" /> : 'Cambiar contraseña'}
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" /> Volver al inicio de sesión
      </Link>
    </AuthLayout>
  )
}
