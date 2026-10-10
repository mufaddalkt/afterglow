# AFTERGLOW RUSH

An original, complete browser arcade race on a 2.61 km sunset harbor circuit.

**Play:** https://afterglow-rush.vercel.app/

Open **AFTERGLOW-RUSH.html** in a modern browser to play offline. It contains the complete game and needs no installation or network access. For the hosted version, use the Vercel link supplied in the chat.

## Controls

- **W / Up:** accelerate
- **S / Down:** brake
- **A, D / Left, Right:** steer
- **Space + steering:** drift / handbrake
- **Shift:** nitro
- **Esc / P:** pause or resume
- **R:** restart
- **M:** sound on or off
- Touch controls appear on touch devices; landscape is recommended.

Finish first against five AI rivals. Collect cyan nitro bottles, drift to refill nitro, take ramps for air-time energy, and use the right-side express route for a shortcut. Civilian cars, barriers, and cones affect the race. The minimap, four checkpoints, speedometer, body-damage meter, and race progress keep you oriented.

## Included

- Original procedural cars, city, road materials, signs, bridges, tunnel, ramps, and course.
- Dynamic chase camera, HDR bloom, nitro radial blur and trails, exhaust flames, sparks, smoke, skid marks, and cosmetic collision damage.
- Original synthesized 136 BPM music and engine, tire, nitro, collision, pickup, and UI effects.
- Countdown, one complete lap, ranking, win/lose results, local personal best, pause, and restart.
- Adaptive render resolution and a direct-render fallback where HDR is unsupported.

The repository contains the modular static website. Serve its `dist` folder through any static HTTP server; `node server.mjs` starts a local server on port 4173. No build or dependency installation is required. The repository version loads the pinned Three.js runtime from jsDelivr; the downloadable offline edition bundles it locally.

Three.js is used under its MIT license, included at `dist/vendor/THREE-LICENSE.txt`. Game branding, vehicle designs, course, interface, visual assets, and synthesized music are original. Driving is intentionally assisted arcade handling, and civilian traffic follows simplified lane behavior.
