import { useRef } from 'react'
import type { ChangeEvent, InputHTMLAttributes } from 'react'

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (value: string) => void
}

/** Russian phone input stored canonically as +7 followed by exactly 10 digits. */
export default function PhoneInput({ value, onChange, onFocus, ...props }: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    const prefixIndex = raw.indexOf('+7')
    const digits = raw.replace(/\D/g, '')

    if (!digits) {
      onChange('+7')
      return
    }

    let national: string
    if (prefixIndex >= 0) {
      // If the caret is moved before +7, digits typed there are still national digits.
      const beforePrefix = raw.slice(0, prefixIndex).replace(/\D/g, '')
      const afterPrefix = raw.slice(prefixIndex + 2).replace(/\D/g, '')
      national = beforePrefix + afterPrefix
      if (national.startsWith('8')) national = national.slice(1)
      if (prefixIndex > 0) {
        const caret = Math.min(2 + beforePrefix.length, 12)
        window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(caret, caret))
      }
    } else {
      national = digits
      // Accept 8XXXXXXXXXX, 7XXXXXXXXXX, and 10 national digits.
      if (national.startsWith('8')) national = national.slice(1)
      else if (national.startsWith('7')) {
        national = national.slice(1)
        if (national.startsWith('8')) national = national.slice(1)
      }
    }

    onChange('+7' + national.slice(0, 10))
  }

  return (
    <input
      {...props}
      ref={inputRef}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      value={value}
      maxLength={24}
      pattern={String.raw`\+7[0-9]{10}`}
      title="Введите +7 и ровно 10 цифр после кода страны"
      placeholder="+7 (___) ___-__-__"
      onFocus={event => {
        if (!value) {
          onChange('+7')
          window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(2, 2))
        }
        onFocus?.(event)
      }}
      onChange={handleChange}
      aria-invalid={value.length > 2 && !isValidRussianPhone(value)}
    />
  )
}

export const isValidRussianPhone = (value: string) => /^\+7\d{10}$/.test(value)
