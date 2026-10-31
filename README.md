# MANHUNT LIVE

A real-world GPS pursuit game for friend groups where players are CHASERS or RUNNERS and the real city is the map. Built with an aggressive street-punk minimalist aesthetic and an OLED-optimized tactical design system.

## Monorepo Architecture

```
manhunt/
├── /app        # Mobile React Native / Expo application (Expo Router, MapLibre, Zustand)
├── /server     # Authoritative Node.js + Express + Socket.io + Mongoose server
├── /shared     # Shared TypeScript models, contracts, and socket event names
└── package.json
```

## Tech Stack
- **Mobile**: React Native, Expo Dev Build, Expo Router, TypeScript, Zustand, MapLibre, expo-location.
- **Backend**: Node.js, Express, Socket.io, TypeScript, Mongoose, Zod.
- **Design Tokens**: Extracted directly from Google Stitch project `5504065792171940726`.

## Setup & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` in both `/server` and `/app`:
```bash
cp server/.env.example server/.env
cp app/.env.example app/.env
```
Fill in your MongoDB connection string (local or Atlas) and OAuth credentials in `server/.env`.

### 3. Build Shared Library
```bash
npm run build:shared
```

### 4. Run Server
```bash
npm run start:server
```
The server will start on `http://localhost:4000` (Health endpoint: `http://localhost:4000/api/health`).

### 5. Run Mobile App
```bash
npm run start:app
```
To run on Android emulator or connected device:
```bash
npm --workspace=app run android
```

### 6. Type Checking & Tests
```bash
npm run typecheck
npm run test:server
```
