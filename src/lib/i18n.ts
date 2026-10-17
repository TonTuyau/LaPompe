// LaPompe's words, from public/_locales (English and French, as the browser): `t('key', 'first', 'second')` puts the
// values in place of $1, $2.
import { ext } from './ext'

export function t(key: string, ...values: (string | number)[]): string {
  return ext.i18n.getMessage(key, values.map(String)) || key
}

/** "12 minutes ago", "in 18 minutes", in the browser's language. */
export function relative(at: Date, now: Date = new Date()): string {
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000)
  const format = new Intl.RelativeTimeFormat(ext.i18n.getUILanguage(), { numeric: 'auto' })
  return Math.abs(minutes) < 60 ? format.format(minutes, 'minute') : format.format(Math.round(minutes / 60), 'hour')
}
