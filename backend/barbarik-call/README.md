# BARBARIK Real AI Calling Backend

This backend is intentionally separate from the GitHub Pages UI. The browser must never contain telephony API credentials.

## Target flow

BARBARIK UI -> secure backend -> Exotel Voice/Call API -> Nandu's mobile number.

Exotel documents Voice APIs and outbound calling, and provides call status/details APIs. See the official developer portal before production setup.

## Required secrets (backend only)

- EXOTEL_API_KEY
- EXOTEL_API_TOKEN
- EXOTEL_ACCOUNT_SID
- EXOTEL_REGION (for example `api.in.exotel.com` for the Mumbai cluster)
- EXOTEL_CALLER_ID / ExoPhone
- BARBARIK_OWNER_NUMBER

Never commit these values to GitHub.

## Production requirements

1. Complete Exotel account/KYC/setup as required by Exotel.
2. Configure the Exotel voice flow/app that speaks the generated Marathi/Hinglish briefing.
3. Deploy the backend function (Supabase Edge Function or equivalent).
4. Store secrets in backend environment variables.
5. Point BARBARIK's CALL ME NOW action to the backend endpoint.
6. Record call SID/status in a call-history table.

The current repository remains a frontend/PWA. This folder is the backend integration contract; no fake successful phone calls are generated.
