# Focus21

Watch-time tracking and paid survey platform for creators and viewers across YouTube, Twitch, Kick, and similar platforms.

## Components

| App | Path | Role |
| --- | --- | --- |
| **API** | `apps/api` | Auth, watch heartbeats, demographic matching, surveys, payouts balance |
| **Web** | `apps/web` | Landing, signup, viewer dashboard, channel portal |
| **Extension** | `apps/extension` | Tracks channel/watch time in-browser and pops survey offers |

## Quick start

```bash
npm install
npm run db:push
npm run db:seed
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:5173
npm run build -w @focus21/extension
```

Load the unpacked extension from `apps/extension/dist` in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

### Demo accounts

| Email | Password | Role |
| --- | --- | --- |
| `viewer@focus21.dev` | `password123` | Viewer (seeded with 75+ min watch time) |
| `creator@focus21.dev` | `password123` | Channel owner with an active survey |

## How the loop works

1. **Viewer** installs the extension and signs in.
2. While watching YouTube / Twitch / Kick, the content script detects channel + media metadata and sends heartbeats every ~15s.
3. **Creators** register channels in the portal and publish surveys with targeting (daily watch minutes, age, gender, platforms, etc.).
4. The API matches eligible viewers and creates survey offers.
5. The extension shows an on-page popup (and a system notification). Completing a survey credits the viewer balance.

## API surface (selected)

- `POST /auth/register` · `POST /auth/login` · `GET/PATCH /auth/me`
- `POST /watch/heartbeat` · `GET /watch/stats`
- `POST /channels` · `GET /channels/mine`
- `POST /surveys` · `GET /surveys/mine` · `POST /surveys/match`
- `GET /surveys/offers` · `POST /surveys/:id/respond`

## Stack

- API: Fastify, Prisma, SQLite, JWT, Zod
- Web: Vite, React 19, React Router
- Extension: Chrome Manifest V3 (esbuild)
