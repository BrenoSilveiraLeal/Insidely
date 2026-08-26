# Google Meet

The application creates a Google Meet space after Stripe confirms a booking. The link is saved in `Booking.meetingUrl` and shown to both participants. If Google is temporarily unavailable, the payment remains confirmed and the scheduled retry route tries again.

## Google Cloud

1. Create or select a project in Google Cloud Console.
2. Enable **Google Meet REST API**.
3. Configure the OAuth consent screen. For production, complete the app verification requirements if Google requests them.
4. Create an OAuth 2.0 client for the account that will create the Meet spaces.
5. Request this scope:
   `https://www.googleapis.com/auth/meetings.space.created`

The application account must authorize the client once and generate a refresh token. This integration uses the refresh token server-side; the application does not expose a `/api/google/callback` route.

If Google OAuth Playground is used to generate the token, register/use its redirect URI:
`https://developers.google.com/oauthplayground`

Store the resulting refresh token only in Vercel as `GOOGLE_REFRESH_TOKEN`.

## Vercel variables

Set these variables in Production and redeploy:

```text
GOOGLE_MEET_ENABLED=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

Do not put the client secret or refresh token in `NEXT_PUBLIC_*` variables or commit them to Git.

## Behavior

- `checkout.session.completed` creates the Meet space after confirming payment.
- `/api/cron/create-meetings` retries confirmed bookings without a link every 15 minutes.
- The link appears in the customer dashboard and consultant consultations page.
- The existing calendar `.ics` download includes the Meet URL when available.
