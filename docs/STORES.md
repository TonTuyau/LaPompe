# Publishing to the add-on stores

A version tag publishes LaPompe to Firefox's and Chrome's stores by itself, once you approve it
(`.github/workflows/release.yml`):

1. the tag `vX.Y.Z` (the version of `package.json`) runs the checks, then makes the GitHub Release with the Chrome
   and Firefox zips and the source package;
2. two jobs, **firefox store** and **chrome store**, then wait in the `stores` environment: on the run's page,
   **Review deployments**, tick them, **Approve and deploy**;
3. each one submits the version for its store's review (`scripts/publish-store.ts`):
   - **Firefox (addons.mozilla.org):** the zip as a new listed version of `tontuyau@lapompe`, its notes
     (`docs/releases/X.Y.Z.md`, in English), and the source package for Mozilla's reviewers
     ([BUILD.md](BUILD.md));
   - **Chrome Web Store:** the zip, submitted to be published by itself as soon as Google approves it.

A store's job that failed (a store down, a refusal) is re-run alone: **Re-run failed jobs**. A store never takes the
same version twice: once a job got past its upload, a fix is a new version.

The listing itself (descriptions, screenshots, privacy answers) isn't sent: it stays as set on each store's page
([store/README.md](store/README.md)).

## Setting it up, once

The credentials are secrets of the `stores` environment: only its jobs read them, and only after your approval.

### The `stores` environment

GitHub → the repository → **Settings → Environments → New environment**, named `stores`:

- **Required reviewers:** yourself (leave **Prevent self-review** unticked, or nobody can approve your own tags);
- **Deployment branches and tags:** **Selected branches and tags** → **Add deployment branch or tag rule** → type
  **Tag**, pattern `v*`;
- **Environment secrets:** the five below.

### Firefox: an AMO API key

https://addons.mozilla.org/developers/addon/api/key/ (signed in as the add-on's owner) → **Generate new credentials**:

| Secret           | Value                           |
| ---------------- | ------------------------------- |
| `AMO_JWT_ISSUER` | the **JWT issuer** (`user:…:…`) |
| `AMO_JWT_SECRET` | the **JWT secret**              |

### Chrome: a service account

A Google Cloud service account publishes for you (no refresh token to renew):

1. https://console.cloud.google.com: a project (a new one, `lapompe` for instance) → **APIs & Services → Library** →
   **Chrome Web Store API** → **Enable**;
2. **IAM & Admin → Service accounts → Create service account** (a name, no role, no access to grant) → the account
   → **Keys → Add key → Create new key → JSON**: a `.json` file downloads;
3. the Chrome Web Store's Developer Dashboard (https://chrome.google.com/webstore/devconsole) → **Account** → add the
   service account's email (`…@….iam.gserviceaccount.com`); note the **Publisher ID** shown there.

| Secret                    | Value                                                                  |
| ------------------------- | ---------------------------------------------------------------------- |
| `CWS_SERVICE_ACCOUNT_KEY` | the whole content of the `.json` file (then delete the file)           |
| `CWS_PUBLISHER_ID`        | the Publisher ID                                                       |
| `CWS_EXTENSION_ID`        | LaPompe's id: the 32 letters in its store address, or on the Dashboard |

If creating the key is refused ("key creation is disabled"), the project belongs to an organization whose policy
forbids keys: use a project outside it.

## Checking it without publishing

`node scripts/publish-store.ts <firefox|chrome> --dry-run`, with the variables above set and the zips built
(`pnpm run build`; the source package: `git archive --format=zip --prefix=lapompe-X.Y.Z/ --output=dist/lapompe-X.Y.Z-source.zip HEAD`),
checks the files and that each credential is there (a service account's key must read as one), and sends nothing.
