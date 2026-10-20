# Publishing LaPompe in the add-on stores

What each store asks for, ready to use: the listing, set once on each store's page. Each new version is then uploaded
by the release workflow, once approved ([STORES.md](../STORES.md)); by hand, the files come from the version's GitHub
Release (https://github.com/TonTuyau/LaPompe/releases): `lapompe-<version>-firefox.zip`, `lapompe-<version>-chrome.zip`,
and, for Mozilla, `lapompe-<version>-source.zip`.

|                                                       |                                                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listing.en.md`, `listing.fr.md`                      | the texts: name, summary, description, category, links; and, in English, Chrome's single purpose, permission justifications and data answers, Firefox's data and source answers |
| `screenshot-1-popup.png`, `screenshot-2-settings.png` | 1280×800, both stores                                                                                                                                                           |
| `promo-tile-440x280.png`                              | Chrome's small promotional tile                                                                                                                                                 |
| `../../PRIVACY.md`                                    | the privacy policy both stores link to: https://github.com/TonTuyau/LaPompe/blob/main/PRIVACY.md                                                                                |
| `../BUILD.md`                                         | how Mozilla's reviewers rebuild it from the source package                                                                                                                      |

The icon (128 px and the others) is in the extension itself, drawn from `icons/lapompe.svg`.

The screenshots are taken from the real extension in Chrome, talking to a stand-in TonTuyau 1.5.0.
