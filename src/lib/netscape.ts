// The browser's cookies as a Netscape cookie file, the format TonTuyau takes (and hands to yt-dlp): a line a cookie,
// 7 fields by tabs: domain, whether its subdomains get it, path, secure, expiry (Unix seconds; 0: a session
// cookie), name, value. An HttpOnly cookie's line starts with #HttpOnly_ (curl's convention, which yt-dlp reads).

export const header = '# Netscape HTTP Cookie File'

export function netscapeFile(cookies: chrome.cookies.Cookie[]): string {
  const lines = [...cookies]
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name) || a.path.localeCompare(b.path))
    .map((c) =>
      [
        (c.httpOnly ? '#HttpOnly_' : '') + c.domain,
        c.hostOnly ? 'FALSE' : 'TRUE',
        c.path,
        c.secure ? 'TRUE' : 'FALSE',
        String(c.session || c.expirationDate === undefined ? 0 : Math.floor(c.expirationDate)),
        c.name,
        c.value,
      ].join('\t'),
    )
  return [header, ...lines].join('\n') + '\n'
}

/** The browser's youtube.com cookies (its subdomains' too): what TonTuyau keeps of a cookie file. */
export async function youTubeCookies(cookies: typeof chrome.cookies): Promise<chrome.cookies.Cookie[]> {
  return (await cookies.getAll({ domain: 'youtube.com' })).filter(
    (c) => c.domain === 'youtube.com' || c.domain.endsWith('.youtube.com'),
  )
}
