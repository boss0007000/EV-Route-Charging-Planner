# CI release pipeline (GitHub -> Play Console, one-time setup)

`.github/workflows/release-play-store.yml` builds a signed release AAB and
uploads it to the Play Console **production** track as a **draft**. A draft
never goes live on its own — you still open Play Console, review it, and
click "Start rollout to Production" yourself. GitHub only does the
build-and-upload leg; you keep the approval.

Run it by pushing a tag (`git tag release-7 && git push origin release-7`)
or from the Actions tab -> "Build & upload release to Play Console" -> "Run
workflow".

None of the steps below should be run by an assistant — these are
credentials for your Google account and your app's signing key, so do them
yourself, directly.

## 1. Google Cloud: service account for the Play Developer API

1. In [Google Cloud Console](https://console.cloud.google.com/), either
   reuse the project tied to your Google Maps API key or create a new one.
2. APIs & Services -> Library -> enable **Google Play Android Developer
   API**.
3. IAM & Admin -> Service Accounts -> Create service account (e.g.
   `play-console-publisher`). No project-level role needed — access is
   granted from Play Console instead (next step).
4. Open the new service account -> Keys -> Add key -> Create new key ->
   JSON. This downloads a `.json` file — keep it private, it's a credential.

## 2. Play Console: grant that service account access

1. [Play Console](https://play.google.com/console/) -> Settings -> API
   access -> link the Cloud project from step 1 if it isn't linked yet.
2. Under "Service accounts", find the one you just created -> "Manage Play
   Console permissions".
3. Grant it **App access** to ChargeRoute, and under permissions give it at
   least:
   - **Releases**: "Create, edit, and delete draft releases" (do **not**
     also grant "Release to production, exclude devices, and use Play App
     Signing" — leaving that out means this service account physically
     cannot publish a release, only draft one, so CI can't go live even if
     the workflow were changed to try).

## 3. GitHub secrets

Settings -> Secrets and variables -> Actions -> New repository secret, for
each of:

| Secret | Value |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Same value as `GOOGLE_MAPS_API_KEY` in your local `.env` |
| `OPEN_CHARGE_MAP_API_KEY` | Same value as `OPEN_CHARGE_MAP_API_KEY` in your local `.env` |
| `ANDROID_KEYSTORE_BASE64` | Base64 of `android/app/chargeroute-upload.keystore` — generate with the command below |
| `ANDROID_KEYSTORE_PASSWORD` | `MYAPP_UPLOAD_STORE_PASSWORD` from your `~/.gradle/gradle.properties` |
| `ANDROID_KEY_ALIAS` | `MYAPP_UPLOAD_KEY_ALIAS` from the same file |
| `ANDROID_KEY_PASSWORD` | `MYAPP_UPLOAD_KEY_PASSWORD` from the same file |
| `PLAY_SERVICE_ACCOUNT_JSON` | The full contents of the JSON key file from step 1 |

To base64-encode the keystore (run locally, from the repo root):

```bash
base64 -w0 android/app/chargeroute-upload.keystore
```

Copy the output and paste it as the `ANDROID_KEYSTORE_BASE64` secret value.
(On macOS, use `base64 -i android/app/chargeroute-upload.keystore` instead
— no `-w0`.)

If you'd rather not copy-paste secret values through a browser form, the
GitHub CLI can set them from your terminal without ever printing them:

```bash
gh secret set ANDROID_KEYSTORE_BASE64 --repo boss0007000/EV-Route-Charging-Planner --body "$(base64 -w0 android/app/chargeroute-upload.keystore)"
gh secret set GOOGLE_MAPS_API_KEY --repo boss0007000/EV-Route-Charging-Planner
gh secret set OPEN_CHARGE_MAP_API_KEY --repo boss0007000/EV-Route-Charging-Planner
gh secret set ANDROID_KEYSTORE_PASSWORD --repo boss0007000/EV-Route-Charging-Planner
gh secret set ANDROID_KEY_ALIAS --repo boss0007000/EV-Route-Charging-Planner
gh secret set ANDROID_KEY_PASSWORD --repo boss0007000/EV-Route-Charging-Planner
gh secret set PLAY_SERVICE_ACCOUNT_JSON --repo boss0007000/EV-Route-Charging-Planner < /path/to/service-account.json
```

(The commands with no `--body` prompt you to paste the value and press
Ctrl-D — nothing is echoed to the terminal.)

## 4. Each release from here on

1. Bump `versionCode` in `android/app/build.gradle` and commit it (same as
   before — a versionCode can only be uploaded to Play Console once).
2. Push a tag: `git tag release-<versionCode> && git push origin release-<versionCode>`.
3. Watch the run under the repo's Actions tab.
4. In Play Console -> Production -> you'll see a new draft release. Review
   it and click "Start rollout to Production" when you're ready — that's
   the approval step, and it only happens there.
