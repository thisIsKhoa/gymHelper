# 1) System Architecture

## Scope
Personal workout tracker focused on individual performance tracking only.
No social sharing, community feeds, or recommendation marketplace features.

## Stack
- Frontend: React + TypeScript + TailwindCSS + Framer Motion + Recharts
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL

## Runtime Design
- Mobile-first SPA calls REST API under `/api/v1`.
- JWT auth protects user-specific resources.
- Prisma models are chart-friendly: session date, entry loads, PR snapshots, weekly progression, and body metric points.
- Optional Socket.IO channel supports real-time rest timer ticks.

## Backend Module Layout
- `auth`: register/login/profile
- `workout`: session logging, history, PR updates
- `progress`: exercise progression by week + PR overview
- `body-metrics`: body composition tracking
- `plan`: create/edit/duplicate custom schedules
- `dashboard`: overview aggregates for home screen

## Frontend App Layout
- `dashboard`: quick stats + bench progression focus
- `session`: live exercise logger + set rest timer
- `progress`: line/bar charts for strength and workload
- `metrics`: body data logging + trend charts
- `plan`: reusable schedule builder (Push/Pull/Legs etc.)

## Scalability Notes
- Feature-based module separation keeps APIs maintainable.
- Chart data is pre-shaped at service level for low frontend transform cost.
- All user data queries are indexed by `userId` + time dimensions.
