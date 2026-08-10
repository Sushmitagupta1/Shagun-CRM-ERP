export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail.map((d) => {
      if (typeof d === 'string') return d
      if (d && typeof d === 'object' && 'msg' in d) return String((d as { msg: unknown }).msg)
      return String(d)
    })
    return messages.filter(Boolean).join(', ') || fallback
  }
  return fallback
}
