# Release signing setup (one-time, per machine)

The release build reads its signing config from properties that live in your
**global** `~/.gradle/gradle.properties` — never from this repo. Do this once.

## 1. Generate the upload keystore

Run this from anywhere (requires a JDK — `keytool` ships with it):

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore chargeroute-upload.keystore \
  -alias chargeroute-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

It will ask for a keystore password, your name/org details, and confirm.
**Save the password somewhere durable (password manager) — if you lose this
file or its password, you can never publish an update to this app again**,
you'd have to ship it as a brand new listing.

Move the resulting `chargeroute-upload.keystore` file into `android/app/`
in this repo (it's already git-ignored — see `.gitignore`).

## 2. Point Gradle at it

Add these four lines to `~/.gradle/gradle.properties` (create the file if it
doesn't exist — this is your user home directory, not the repo):

```properties
MYAPP_UPLOAD_STORE_FILE=chargeroute-upload.keystore
MYAPP_UPLOAD_STORE_PASSWORD=<the password you set above>
MYAPP_UPLOAD_KEY_ALIAS=chargeroute-upload
MYAPP_UPLOAD_KEY_PASSWORD=<the same password, unless you set a separate key password>
```

## 3. Build

```bash
cd android && ./gradlew bundleRelease
```

Output lands at `android/app/build/outputs/bundle/release/app-release.aab` —
that's the file you upload to Play Console.

If `MYAPP_UPLOAD_STORE_FILE` isn't set, `bundleRelease` will fail with a
clear "keystore not found" error rather than silently signing with the debug
key — that's intentional.

## 4. Get the SHA-1 for the Google Maps API key restriction

```bash
keytool -list -v -keystore android/app/chargeroute-upload.keystore -alias chargeroute-upload
```

Copy the `SHA1:` fingerprint and add it (plus your debug keystore's SHA-1, if
you also test debug builds) as an allowed fingerprint for the Android
restriction on the Google Maps API key in Google Cloud Console.
