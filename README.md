# Bing Beats

Bing Beats is an Expo + React Native app for discovering music by place and time.
Pick a country and year, explore tracks, and chat with an assistant that can suggest playlist-style results in context.

## Project Structure

- `BingBeats/` - main mobile app (Expo Router)

## Prerequisites

- Node.js 18+
- npm
- Expo Go app (optional, for running on a device)

## Setup

1. Install dependencies:

```bash
cd BingBeats
npm install
```

2. Configure environment variables in `BingBeats/.env`:

```env
EXPO_PUBLIC_API_URL=https://bing-beats.onrender.com
```

Use your deployed backend URL. If you run the backend locally, set the correct reachable host for your device/simulator.

## Run the App

From `BingBeats/`:

- Start Expo:

```bash
npm run start
```

- iOS simulator:

```bash
npm run ios
```

- Android emulator:

```bash
npm run android
```

- Web:

```bash
npm run web
```

If you change `.env`, restart Expo (prefer `npx expo start --clear`).

## Available Scripts

Inside `BingBeats/`:

- `npm run start` - starts the Expo dev server
- `npm run ios` - opens iOS target
- `npm run android` - opens Android target
- `npm run web` - runs web target
- `npm run lint` - runs Expo lint