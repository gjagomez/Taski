import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

/**
 * Código de verificación en cuadritos (uno por dígito). Avanza solo al escribir, retrocede con Backspace,
 * se mueve con las flechas y acepta pegar el código completo (también desde el SMS/correo en el móvil).
 */
export function CodeInput({
  value,
  onChange,
  length = 6,
  invalid = false,
  autoFocus = false,
}: {
  value: string
  onChange: (code: string) => void
  length?: number
  invalid?: boolean
  autoFocus?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  // Una casilla vacía se guarda como espacio para que los demás dígitos no cambien de posición
  const digits = Array.from({ length }, (_, i) => (value[i] ?? '').trim())
  const emit = (next: string[]) => onChange(next.map((c) => c || ' ').join('').trimEnd())

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus()

  // Escribe `text` (solo dígitos) a partir de la casilla `from`
  function fill(from: number, text: string) {
    const clean = text.replace(/\D/g, '')
    if (!clean) return
    const next = [...digits]
    for (let k = 0; k < clean.length && from + k < length; k++) next[from + k] = clean[k]
    emit(next)
    focus(from + clean.length)
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...digits]
      // Si la casilla está vacía, borra la anterior
      const target = next[i] ? i : i - 1
      if (target < 0) return
      next[target] = ''
      emit(next)
      focus(target)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focus(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focus(i + 1)
    }
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    fill(i, e.clipboardData.getData('text'))
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Código de verificación">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          id={i === 0 ? 'code' : undefined}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          maxLength={length}
          value={d}
          aria-label={`Dígito ${i + 1}`}
          aria-invalid={invalid}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onChange={(e) => {
            const v = e.target.value
            // Autocompletado del código completo (móvil) o un dígito nuevo junto al que ya había
            fill(i, v.length > 2 ? v : v.length === 2 ? (v[0] === d ? v[1] : v[0]) : v)
          }}
          className={cn(
            'size-12 min-w-0 flex-1 rounded-xl border border-input bg-background text-center font-mono text-2xl font-bold text-foreground shadow-xs outline-none transition sm:size-14',
            'focus:border-primary focus:ring-3 focus:ring-primary/20',
            d && 'border-primary/40 bg-primary/5',
            invalid && 'border-destructive ring-3 ring-destructive/15'
          )}
        />
      ))}
    </div>
  )
}
