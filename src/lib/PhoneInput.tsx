import type { ChangeEvent, InputHTMLAttributes } from 'react'

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (value: string) => void
}

/** Russian phone input stored canonically as +7 followed by exactly 10 digits. */
export default function PhoneInput({ value, onChange, onFocus, ...props }: PhoneInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    const digits = raw.replace(/\D/g, '')

    // If +7 is already prefilled and the user starts with domestic trunk prefix 8,
    // treat it as the prefix to replace, not as the first national digit.
    if (value === '+7' && digits === '78') {
      onChange('+7')
      return
    }

    let national = digits
    if (national.startsWith('8')) national = national.slice(1)
    else if (national.startsWith('7')) national = national.slice(1)

    onChange(national ? '+7' + national.slice(0, 10) : '')
  }

  return (
    <input
      {...props}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      value={value}
      maxLength={12}
      placeholder="+7 (___) ___-__-__"
      onFocus={event => {
        if (!value) onChange('+7')
        onFocus?.(event)
      }}
      onChange={handleChange}
      aria-invalid={value !== '' && !/^\+7\d{10}$/.test(value)}
    />
  )
}

export const isValidRussianPhone = (value: string) => /^\+7\d{10}$/.test(value)
