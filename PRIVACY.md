# LaPompe's privacy policy

_Last updated: 2026-10-17._

LaPompe is the browser extension of [TonTuyau](https://github.com/TonTuyau/TonTuyau), a server you host yourself. It
exists to send your YouTube sign-in to **your own** TonTuyau, so that TonTuyau reads YouTube signed in as you. It has
no server of its own, no analytics, no ads, and its makers receive nothing from it.

## What LaPompe reads

- **Your youtube.com cookies**: the browser's cookies for youtube.com and its subdomains, which hold your YouTube
  sign-in. No other site's cookies.
- **The address of the YouTube page you are on**, by its content script on youtube.com, to know which video or channel
  its "Add to TonTuyau" button is about.
- **A channel's page on youtube.com**, only when you click "Add to TonTuyau" on a channel opened by its @handle: its
  address doesn't say the channel's id, its page does. LaPompe reads that id from it and nothing else.

Nothing else of YouTube's pages is read or sent.

## Where it sends it

- **Only to the TonTuyau address you type in its settings**, with the API key you made in that TonTuyau:
  - your youtube.com cookies, every N minutes (you choose N) and when you click "Send the cookie now";
  - the id of a video or channel, only when you click "Add to TonTuyau" (with TonTuyau 1.6 or later).
- **Nowhere else.** Its only other request is reading a channel's page from youtube.com itself, as above. No third
  party, no tracking, no updates server of its own (the browser's add-on store updates it).

What TonTuyau does with your cookie is up to your TonTuyau: it keeps it to read YouTube as you, and you can remove it
from TonTuyau's YouTube page at any time.

## What LaPompe keeps

In the browser's own storage for the extension, on your computer only: your settings (TonTuyau's address, the API
key, how often it sends), what TonTuyau last answered (when, and whether YouTube took the cookie), and TonTuyau's
version and the key's name. Removing LaPompe removes them.

## Permissions it asks for

| Permission                           | Why                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `cookies`, and access to youtube.com | to read your youtube.com cookies, to add its button to YouTube's pages, and to read a channel's page for its id |
| access to your TonTuyau's address    | asked when you save its settings, for that one address only: to send to it                                      |
| `storage`                            | to keep its settings and TonTuyau's last answer                                                                 |
| `alarms`                             | to send the cookie every N minutes                                                                              |

## Contact

Questions or concerns: [open an issue](https://github.com/TonTuyau/LaPompe/issues).
