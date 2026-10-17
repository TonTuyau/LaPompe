# LaPompe: the stores' listing (English)

What to paste in each store's form. Limits are the stores' own.

## Name

LaPompe

## Summary (Firefox: 250 characters at most; Chrome takes the manifest's description, 132 at most)

Sends your YouTube sign-in to your own TonTuyau server, so it reads YouTube as you; with TonTuyau 1.6, adds "Add to
TonTuyau" buttons to YouTube.

## Description

LaPompe is the browser extension of TonTuyau, a YouTube-like app you host yourself over your video library
(https://github.com/TonTuyau/TonTuyau). LaPompe remplit TonTuyau.

What it does:

- Sends your youtube.com cookies to your TonTuyau every few minutes (30 by default, your choice) and when you click
  "Send the cookie now". TonTuyau then reads YouTube signed in as you, which avoids most of YouTube's bot checks and
  lets it read the videos your account can see. YouTube renews its cookies while you browse: sending them often keeps
  TonTuyau's copy working.
- Shows, in its popup, what your TonTuyau answered: whether YouTube took the cookie, when it was sent, when it goes next.
- Adds "Add to TonTuyau" next to Subscribe on YouTube's video and channel pages. It's disabled until your TonTuyau is
  1.6 or later, the version that downloads.

What you need: a TonTuyau server (1.5 or later) and an API key of kind "Browser extension" made in it.

Privacy: LaPompe sends only your youtube.com cookies, and only to the TonTuyau address you set. No other site, no
tracking, no server of its own. Its source is open (MIT): https://github.com/TonTuyau/LaPompe

## Category

- Firefox: Download Management (else: Other)
- Chrome: Tools

## Support

- Website and support: https://github.com/TonTuyau/LaPompe
- Privacy policy: https://github.com/TonTuyau/LaPompe/blob/main/PRIVACY.md
- License: MIT

## Chrome: single purpose

Sends the user's YouTube sign-in (their youtube.com cookies) to the TonTuyau server they host themselves, so that
server reads YouTube as them.

## Chrome: permission justifications

- **cookies**: to read the user's youtube.com cookies (their YouTube sign-in), which is what the extension sends to
  their TonTuyau server.
- **storage**: to keep the extension's settings (the TonTuyau server's address, its API key, how often to send) and the
  server's last answer, in the extension's own storage.
- **alarms**: to send the cookie every N minutes, as the user set.
- **Host permission youtube.com**: to read the youtube.com cookies; to add the "Add to TonTuyau" button next to
  Subscribe on YouTube's video and channel pages; and, when that button is clicked on a channel opened by its @handle,
  to read that channel's page to find its id.
- **Optional host permissions (any http/https address)**: each user hosts their own TonTuyau at their own address, which
  the extension can't know in advance. It asks for that one address only, when the user saves it in the settings; it
  never asks for any other site.

## Chrome: remote code

No. All the extension's code is in its package; it runs no code from anywhere else.

## Chrome: data usage

Tick **Authentication information**: the youtube.com cookies, the user's YouTube sign-in. And **Website content**: the
id of a video or channel, from YouTube's page, sent only when the user clicks "Add to TonTuyau". Nothing else is
collected: no browsing history (nothing is sent as the user browses, only the page whose button is clicked).

Certify all three: the data isn't sold to third parties; it isn't used or transferred for purposes unrelated to the
single purpose; it isn't used to determine creditworthiness or for lending. It goes only to the server address the user
sets (their own TonTuyau).

## Firefox: data collection (asked when submitting)

Matches the manifest's `data_collection_permissions`: **Authentication information**, required, sent only to the
TonTuyau address the user sets.

## Firefox: source code

The package is built (Vite bundles it): upload the source package of the same release
(`lapompe-<version>-source.zip`, attached to its GitHub Release), and point the reviewer to `docs/BUILD.md`.
