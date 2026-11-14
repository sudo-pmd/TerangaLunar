export const loc = (lang: string) => (lang.startsWith('en') ? 'en-GB' : 'fr-FR')

export const fmtDate = (ms: number, lang: string, withTime = true) =>
  new Intl.DateTimeFormat(loc(lang), {
    timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(ms) + (withTime ? ' UTC' : '')

export const fmtMonth = (ms: number, lang: string) =>
  new Intl.DateTimeFormat(loc(lang), { timeZone: 'UTC', month: 'short', year: '2-digit' }).format(ms)

export const fmtNum = (x: number, lang: string, digits = 1) =>
  new Intl.NumberFormat(loc(lang), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(x)

/** 76 h -> « 3 j 4 h » (fr) / « 3 d 4 h » (en) */
export function fmtHours(h: number, lang: string): string {
  const dUnit = lang.startsWith('en') ? 'd' : 'j'
  if (h < 1) return `0 h`
  const days = Math.floor(h / 24)
  const rest = Math.round(h - days * 24)
  if (days === 0) return `${rest} h`
  return rest ? `${days} ${dUnit} ${rest} h` : `${days} ${dUnit}`
}

export const fmtSigned = (x: number, lang: string, digits = 1) =>
  (x > 0 ? '+' : x < 0 ? '−' : '±') + fmtNum(Math.abs(x), lang, digits)

export const pct = (x: number, lang: string, digits = 0) => `${fmtNum(x, lang, digits)} %`
