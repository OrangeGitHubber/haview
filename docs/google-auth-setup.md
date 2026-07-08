# Google sign-in setup for HAView

Once this dashboard is reachable from the public internet, it must be gated behind a
login — anyone who finds the URL would otherwise get a live view (and control) of your
home. HAView gates the **entire app** behind Google sign-in, restricted to an explicit
allow-list of Google account email addresses you choose. There is no other account
system, no passwords to manage, and no one outside the allow-list can get past `/login`
no matter what they authenticate with.

If the dashboard never leaves your LAN, you can skip this — but the server **fails
closed**: without the env vars below configured, every page (including `/login`) just
shows a "not configured" message rather than quietly running open.

## 1. Create an OAuth Client in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project
   (or reuse one) → **APIs & Services** → **Credentials**.
2. If prompted, configure the **OAuth consent screen** first: External user type is
   fine, fill in an app name and your email; you don't need to submit for verification —
   add your own Google account(s) under **Test users** if the screen stays in "Testing".
3. **Create Credentials** → **OAuth client ID** → Application type **Web application**.
4. Under **Authorized redirect URIs**, add:

   ```
   https://<your-public-url>/auth/google/callback
   ```

   This must match `PUBLIC_URL` (below) exactly, including scheme and no trailing slash.
5. Save. Copy the **Client ID** and **Client secret** — you'll paste these into env vars.

## 2. Set the environment variables on unraid

In the container's config (Docker tab → edit container, or `deploy/docker-compose.yml`
if you're running compose), add:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the Client ID from step 1 |
| `GOOGLE_CLIENT_SECRET` | the Client secret from step 1 |
| `ALLOWED_GOOGLE_EMAILS` | comma-separated list, e.g. `you@gmail.com,partner@gmail.com` |
| `PUBLIC_URL` | the base URL the dashboard is reachable at, e.g. `https://oranjehuis.example.com` (no trailing slash) |
| `SESSION_SECRET` | optional — if omitted, one is generated and saved to the `/data` volume on first boot |

All five (minus the optional `SESSION_SECRET`) must be set together. If any of
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_GOOGLE_EMAILS`, or `PUBLIC_URL` is
missing, the server refuses to serve the app at all rather than falling back to open
access.

Restart the container after setting these.

## 3. Sign in

Open the dashboard URL — you'll land on `/login` with a **Continue with Google** link.
Sign in with an allow-listed account. Successfully authenticating with Google is not
enough by itself: if the email isn't in `ALLOWED_GOOGLE_EMAILS`, you get a plain "not
authorized" page and no session is created.

A signed-in session is a cookie (`httpOnly`, `Secure`, 30 days) scoped to the device you
signed in on — normal for a wall display or a personal phone/laptop, sign in once per
device. To sign out, visit `/auth/logout`.

## Notes

- `PUBLIC_URL` is used to build the OAuth redirect — it is **not** derived from request
  headers, so a reverse proxy in front of the container can't be tricked into pointing
  the flow somewhere else.
- The HA connection setup (URL + long-lived token, see [ha-setup.md](ha-setup.md)) is a
  separate, unrelated step that happens *after* signing in — Google auth only decides
  who can reach the app at all.
