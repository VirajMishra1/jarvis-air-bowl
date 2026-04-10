# Jarvis Air Bowl

Jarvis Air Bowl is a gesture-controlled mixed-reality bowling prototype built with React, Vite, Three.js, React Three Fiber, Cannon physics, Zustand, and MediaPipe hand/pose tracking.

## Stack

- React 18 + Vite 5
- Three.js + React Three Fiber + Drei
- Cannon physics via `@react-three/cannon`
- Zustand for game state
- MediaPipe Hands + Pose for camera tracking
- ESLint 9 flat config

## Local Setup

1. Install dependencies with `npm install`.
2. Start the dev server with `npm run dev`.
3. Allow camera access when the browser prompts you.
4. Stand far enough back to keep both hands and shoulders visible.

Helpful scripts:

- `npm run dev:host` exposes the dev server on your local network.
- `npm run lint` runs the ESLint checks.
- `npm run build` creates a production build in `dist/`.
- `npm run check` runs lint and build together.

## Gameplay Flow

1. Enter calibration mode on load.
2. Raise or lower your left fist to resize the lane and pins to your room.
3. Fine tune tilt with `Arrow Up` and `Arrow Down`, and floor height with `W` and `S`.
4. Make two fists to lock calibration and start the round.
5. Close either hand to grab the ball, then open it to throw.
6. Press `Space` to force a throw for debugging or fallback testing.

Press `D` to toggle the debug panel.

## Deployment

The app is ready for Vercel as a standard Vite project.

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node version: `20.x` or newer
- Environment variables: none required for the current implementation

The included [`vercel.json`](./vercel.json) handles SPA routing and adds a few basic security headers.

## GitHub / CI

The included GitHub Actions workflow runs on pushes and pull requests:

- `npm ci`
- `npm run lint`
- `npm run build`

That gives you a baseline CI gate before connecting GitHub to Vercel for automatic preview and production deploys.

## Deployment Checklist

- Confirm camera permissions work in the target browser.
- Run `npm run check` locally.
- Verify calibration overlay hides after double-fist lock.
- Verify grabbing and throwing works with both hands.
- Verify score advances and the next round resets correctly.
- Confirm the Vercel project uses the repository root and outputs `dist/`.
- Confirm GitHub Actions passes on the branch being deployed.
- Test the production URL on desktop and mobile-width browser layouts.

## Notes

- MediaPipe model assets load from jsDelivr at runtime.
- The current experience is optimized for desktop/laptop webcams.
- A fully headless environment cannot validate real camera tracking, so browser-based manual verification is still part of the release process.
