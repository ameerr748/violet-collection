# Violet AI Backend

Backend foundation for Violet's AI sales system.

## What this first version does

- Connects securely to the Storage Manager Products API.
- Uses a Bearer token from the `STORAGE_MANAGER_TOKEN` environment variable.
- Syncs the full product catalog through pagination.
- Searches products by product code.
- Checks exact size/color availability from product variants.
- Exposes JSON endpoints for the future AI, Messenger and Meta integrations.

## Security

Never put the Storage Manager token in source code, frontend JavaScript, GitHub Pages, or chat messages.

Set it as an environment variable:

```text
STORAGE_MANAGER_TOKEN=YOUR_NEW_TOKEN
```

The token that was previously pasted into chat should be revoked/replaced before deployment.

## Local run

Requirements: Node.js 20+

```powershell
npm install
npm start
```

Open:

- http://localhost:3000/health
- http://localhost:3000/api/catalog/status
- http://localhost:3000/api/products/520Q
- http://localhost:3000/api/products/520Q/availability?size=39

## Important

The Storage Manager API is currently treated as the source of truth. This project does not copy prices or stock into a second database.