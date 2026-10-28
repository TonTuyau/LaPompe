# LaPompe's privacy policy

_Last updated: 2026-10-27 (0.3.0: several TonTuyau)._

LaPompe is the browser extension of [TonTuyau](https://github.com/TonTuyau/TonTuyau), a server you host yourself. It
exists to send your YouTube sign-in to **your own** TonTuyau (one or several), so that TonTuyau reads YouTube signed in as you. It has
no server of its own, no analytics, no ads, and its makers receive nothing from it.

## What LaPompe reads

- **Your youtube.com cookies**: the browser's cookies for youtube.com and its subdomains, which hold your YouTube
  sign-in. No other site's cookies.
- **The address of the YouTube page you are on**, by its content script on youtube.com, to know which video or channel
  its "Add to TonTuyau" button is about.
- **A channel's page on youtube.com**, when you open a channel by its @handle: its address doesn't say the channel's id,
  its page does. LaPompe reads that id from it and nothing else.

Nothing else of YouTube's pages is read or sent.

## Where it sends it

- **Only to the TonTuyau addresses you type in its settings**, each with the API key you made in that TonTuyau:
  - your youtube.com cookies, to **every** TonTuyau listed, every N minutes (you choose N) and when you click "Send
    the cookie now". The settings page says so: add only TonTuyau whose owner you'd trust with your YouTube session;
  - the id of each YouTube video or channel page you open, to each listed TonTuyau that adds videos (TonTuyau 2.0 or
    later): its button asks them whether they have it already ("In TonTuyau", "Waiting in TonTuyau"), and adds it to
    the one you pick when you click. A TonTuyau doesn't keep these questions; it keeps what you add.
- **Nowhere else.** Its only other request is reading a channel's page from youtube.com itself, as above. No third
  party, no tracking, no updates server of its own (the browser's add-on store updates it).

What TonTuyau does with your cookie is up to your TonTuyau: it keeps it to read YouTube as you, and you can remove it
from TonTuyau's YouTube page at any time.

## What LaPompe keeps

In the browser's own storage for the extension, on your computer only: your settings (each TonTuyau's name, address
and API key, how often it sends), what each TonTuyau last answered (when, and whether YouTube took the cookie), and
each one's version, the key's name and whether it adds. Removing a TonTuyau from the settings removes what was kept of
it; removing LaPompe removes them all.

## Permissions it asks for

| Permission                                    | Why                                                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `cookies`, and access to youtube.com          | to read your youtube.com cookies, to add its button to YouTube's pages, and to read a channel's page for its id |
| browsing activity (Firefox's data collection) | the ids of the YouTube videos and channels you open, sent to your TonTuyau only, as above                       |
| access to your TonTuyau's addresses           | asked when you save the settings, for those addresses only: to send to them; given back when one is removed     |
| `storage`                                     | to keep its settings and TonTuyau's last answer                                                                 |
| `alarms`                                      | to send the cookie every N minutes                                                                              |

## Contact

Questions or concerns: [open an issue](https://github.com/TonTuyau/LaPompe/issues).
