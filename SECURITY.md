# Security Notes

- Never commit Storage Manager Bearer tokens.
- Store secrets in environment variables or your hosting provider's secret manager.
- The token exposed in the previous chat must be revoked/replaced before use.
- Do not paste cookies, Authorization headers, API keys, or session tokens into GitHub issues, README files, or chat.
- This backend is server-side only; do not call the Storage Manager API directly from browser JavaScript.
