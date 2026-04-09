# 1) System Architecture

## Product Goal

Personal Workout Tracker is designed for individual athletes to log sessions quickly, monitor strength/body trends, and follow long-term progressive overload.

## Core Architecture

- Frontend: React + TypeScript + TailwindCSS + Framer Motion + Recharts + Zustand
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL
- Auth: JWT
- Queue: BullMQ + Redis for durable background jobs
- Realtime utility: Socket.IO for timer ticks + achievement/level-up events

## High-Level Flow

1. User logs sets from the mobile-first workout screen.
2. API persists session and entries in one transaction.
3. API enqueues a gamification job into Redis and returns response immediately.
4. Worker processes EXP/level/achievement logic with retry and idempotency guard.
5. Worker publishes realtime events through Redis Pub/Sub; API emits Socket.IO to user room.
6. Progress and dashboard APIs return chart-ready data (minimal frontend transform).

## Backend Modules

- auth: register, login, profile
- workout: session CRUD-like flows, compare sessions, smart suggestions, analytics, CSV export
- progress: per-exercise weekly progression (weight, volume, estimated 1RM)
- body-metrics: weight/body-fat/muscle tracking
- plan: create/edit/clone plans with day-level exercises
- dashboard: weekly overview, streak, strongest lift, PR highlights
- exercise-library: predefined + custom exercises with muscle-group and type metadata
- gamification: skill trees, achievements, queue producer/worker, realtime event publishing

## Frontend Modules

- dashboard page: this-week KPIs, weekly volume charts, PR snapshots
- session page: quick logging, RPE, auto rest timer, overload suggestion, offline queue sync, history comparison
- progress page: selected exercise progression with max load + estimated 1RM charts
- body metrics page: daily/weekly composition logs and trends
- plan page: split management with drag-drop exercise ordering
- exercise library page: custom exercise management

## Performance/Scalability Notes

- Weekly pre-aggregation (`WeeklyWorkoutStat`) reduces chart query cost.
- Running totals (`UserGamificationStat`) keep lifetime checks O(1) instead of SUM-over-history.
- BullMQ retries failed jobs and preserves work in Redis across server restarts.
- Time-series queries are indexed by user + date/week dimensions.
- Response payloads are chart-friendly to avoid expensive client reshaping.
- Offline queue enables uninterrupted logging when network is unstable.
