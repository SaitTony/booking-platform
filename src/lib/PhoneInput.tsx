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
    const hasExplicitCountryPrefix = /^\s*\+7/.test(raw)

    if (!digits) {
      onChange('+7')
      return
    }

    let national: string
    if (hasExplicitCountryPrefix) {
      national = digits.slice(2)
      // A domestic 8 typed after the prefilled +7 is a trunk prefix, not a national digit.
      if (national.startsWith('8')) national = national.slice(1)
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
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      value={value}
      maxLength={24}
      pattern="\\+7[0-9]{10}"
      title="Введите +7 и ровно 10 цифр после кода страны"
      placeholder="+7 (___) ___-__-__"
      onFocus={event => {
        if (!value) onChange('+7')
        onFocus?.(event)
      }}
      onChange={handleChange}
      aria-invalid={value.length > 2 && !isValidRussianPhone(value)}
    />
  )
}

export const isValidRussianPhone = (value: string) => /^\+7\d{10}$/.test(value)
