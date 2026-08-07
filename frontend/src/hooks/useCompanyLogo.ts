import { useEffect, useState } from 'react'
import { LOGO_URL } from '@/api/settings'

const FALLBACK = '/shagun-logo.png'

export function useCompanyLogo() {
  const [logo, setLogo] = useState(FALLBACK)

  useEffect(() => {
    const controller = new AbortController()
    fetch(LOGO_URL, { signal: controller.signal })
      .then((res) => {
        if (res.ok) setLogo(`${LOGO_URL}?t=${Date.now()}`)
        else setLogo(FALLBACK)
      })
      .catch(() => setLogo(FALLBACK))
    return () => controller.abort()
  }, [])

  const onError = () => {
    if (logo !== FALLBACK) setLogo(FALLBACK)
  }

  return { logo, onError }
}
