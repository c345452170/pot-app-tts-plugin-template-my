# High-Fidelity 3D Particle Christmas Tree with MediaPipe Hand Gestures

This document maps the requested deliverable into a concrete architecture, file layout, communication protocol, performance tiers, and Nginx configuration. It is scoped for a fat-client SPA built with Vite + React 18, @react-three/fiber, @react-three/drei, and @mediapipe/tasks-vision (WASM) running in a Web Worker.

## 1. Directory structure & responsibilities
```
/src
  /components
    LuxuryTree.jsx         # Particle tree, ornaments, chaos↔formed morph, focus mode
    Atmosphere.jsx         # Snow, gold dust, spiral ribbons, sparkle overlays
    HandOverlay.jsx        # Live hand skeleton/gesture HUD (bottom-left ~55px)
    Overlay.jsx            # Title, subtitle input, upload CTA, glassmorphism UI
  /workers
    handWorker.js          # MediaPipe Tasks Vision (WASM) init + inference loop
  /lib
    quality.js             # detect-gpu based tiering + parameter tables
    gestures.js            # Gesture classification, debouncing, double-pinch detection
    distribution.js        # Tree/ornament spatial distributions & chaos targets
  App.jsx                  # Scene assembly, camera/lighting, state machine wiring
  main.jsx                 # Vite entry, DPR clamping per tier
```
- **S-1**: Tree/atmosphere/hand UI/overlay separated to keep files small.
- **S-2**: Worker handles all ML; main thread only sends frames & consumes results.

## 2. Core implementation strategies
### 2.1 Particle tree & morphing (LuxuryTree)
- **Instancing/Points (TP-1)**: needles rendered via `THREE.InstancedBufferGeometry` or `Points` with custom shader attributes (seed, layer, bark flag). No per-instance mesh creation.
- **GPU morphing (TP-2)**: chaos & formed positions precomputed in `distribution.js`; vertex shader lerps `mix(chaosPos, formedPos, smoothStep)` driven by a uniform `uMorph`. Only uniforms updated per frame.
- **Tree shape (T-2)**: `distribution.js` generates layered conical volumes (`TREE_TIERS`) with tapering radii; below y<0 applies spiral tightening for roots; trunk particles flagged for bark color.
- **Ornaments placement (T-3)**: sample height bias 0.25–0.75 for photos; other ornaments distributed per layer edges. Each ornament type has instanced geometries and PBR-like materials (high metalness, low roughness). At least one gold material for A-2.
- **Focus Mode (T-4)**: when a photo selected, hide its instance, spawn a dedicated mesh positioned in front of camera with `renderOrder=9999`, `depthTest=false`, `transparent=true`, `opacity=1`. Toggleable on double pinch.
- **Chaos↔Formed (T-1)**: easing via `damp` or `lerp` with a low-pass filter; gesture debouncing prevents flicker.

### 2.2 Atmosphere (Atmosphere component)
- **GoldDust**: ~2k points swirling with noise + slight spiral, instanced `Points`.
- **GoldenSpirals**: two ribbon geometries (tube or curve-driven points) wrapping tree; always visible.
- **Snow & Sparkle (P-1)**: custom shaders for downward motion and fade; sparkles flicker alpha via sin noise.
- **Tier-aware density (P-2)**: particle counts & shader toggles reduced on Tier 1 from `quality.js` tables.

### 2.3 Gestures & worker separation
- **Worker (H-1)**: `handWorker.js` imports `HandLandmarker` from `@mediapipe/tasks-vision` (WASM). It receives frames as `ImageBitmap` via `postMessage({type:"frame"}, [bitmap])`, runs inference off-main-thread, returns landmarks + gesture states.
- **Gestures (H-2~H-4)**: `gestures.js` computes Spread/Fist/Pinch/DoublePinch and drag vectors with temporal thresholds (e.g., debounce 120ms, confidence >0.5). Drag controls yaw; vertical hand movement controls zoomFactor → camera z 8–65. Double pinch toggles focus.

### 2.4 Quality tiers (HC-7, Q-1, Q-2)
- **detect-gpu** at startup → tier 1/2/3. `quality.js` exports a table:
  - Tier1: needles ≤5k, DPR=1, disable glow, reduced snow, simpler lighting.
  - Tier2: needles ≈20k, DPR=1.5, enable fake bloom sprite, moderate snow.
  - Tier3: needles ≥40k, DPR=2, full ornaments, richer atmosphere.
- Tier applied to renderer pixel ratio, particle counts, post effects, and shader branches.

### 2.5 Camera & lighting (C-1, C-2)
- PerspectiveCamera; `zoomFactor` maps to z∈[8,65]. Smoothing to avoid motion sickness.
- Lighting: Ambient + SpotLight (warm) + PointLight rim; optional additive sprites for luxe highlights. Tier1 can disable sprites.

### 2.6 UI overlay (Overlay component)
- Metal gradient animated title “Merry Christmas”; subtitle “Especially for [Name]” with exactly one space after “for”, centered, input without underline.
- Upload button: glassmorphism panel, gold border, lightweight sweep on hover (disabled or simplified on Tier1).
- Uploaded image becomes ornament respecting height band 0.25–0.75 (U-2).

## 3. Worker communication protocol (D-4)
### Messages from main → worker
- `{ type: "init", modelAssetPath, numHands, runningMode: "IMAGE"|"VIDEO" }`
- `{ type: "frame", imageBitmap, timestamp }` (bitmap transferred)
- `{ type: "config", options }` (e.g., smoothing params)
- `{ type: "stop" }`

### Messages from worker → main
- `{ type: "ready" }` after model load
- `{ type: "result", landmarks, handedness, gestures, ts }`
- `{ type: "error", message }` with recoverable hint

### Error recovery
- On `error`, main can re-send `init`; worker guards against double-init. Dropped frames are acceptable; main keeps rendering.

## 4. Performance tier table (D-5)
| Tier | needles | DPR | GoldDust | Snow | Glow | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 5k | 1 | 800 | 400 | off | Simplified lighting, sweep disabled |
| 2 | 20k | 1.5 | 1500 | 800 | fake bloom sprite | Moderate sparkles |
| 3 | 40k | 2 | 2500 | 1200 | full | All ornaments enabled |

## 5. Nginx config snippet (D-3)
```nginx
server {
  listen 80;
  listen 443 ssl http2;
  server_name example.com;

  root /var/www/xmas/dist;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Static caching
  location /assets/ {
    add_header Cache-Control "public, immutable, max-age=31536000";
  }
  location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }

  # Compression
  gzip on;
  gzip_types text/plain text/css application/javascript application/wasm application/json image/svg+xml;
  gzip_min_length 1024;
  # brotli if available
  brotli on;
  brotli_types text/plain text/css application/javascript application/wasm application/json image/svg+xml;

  # MIME overrides
  types {
    application/wasm wasm;
    model/gltf-binary glb;
  }

  ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
}
```
**Certbot (HTTPS)**: `sudo certbot --nginx -d example.com -d www.example.com`; renew via `certbot renew` in cron/systemd timer.

## 6. Observable performance checks (PF-1~PF-3)
- Log draw calls from WebGL profiler: expect instanced draw count O(few units) despite high particle count.
- While worker runs inference, verify rotation/zoom FPS stays high (render loop independent; worker uses transferable bitmaps).
- Tier1 self-check: load on low tier, ensure scene renders, gestures switch states, no black screen.

## 7. Definition of Done checklist
- [ ] HC-1 Fat client only (static dist)
- [ ] HC-2 Ubuntu+Nginx deployable
- [ ] HC-3 Vite+React18 SPA
- [ ] HC-4 Three.js + @react-three/fiber + @react-three/drei
- [ ] HC-5 MediaPipe Tasks Vision WASM in worker
- [ ] HC-6 Instancing/Points for tens of thousands of particles
- [ ] HC-7 detect-gpu tiering
- [ ] D-1 Codebase with structure above
- [ ] D-2 Production dist via `npm run build`
- [ ] D-3 Nginx snippet as provided
- [ ] D-4 Worker protocol documented
- [ ] D-5 Tier strategy table included
- [ ] A-1/A-2/A-3 Visual spec ready (colors/materials/UI layout)
- [ ] Q-1/Q-2 Tier differences
- [ ] T-1~T-4 Tree behaviors
- [ ] TP-1/TP-2 Performance paths
- [ ] P-1/P-2 Atmosphere behaviors
- [ ] H-1~H-4 Gesture mapping
- [ ] U-1~U-3 Overlay behaviors
- [ ] C-1/C-2 Camera/lighting
- [ ] N-1~N-3 Nginx behaviors
- [ ] PF-1~PF-3 Performance observables
```

Use this plan as the blueprint for implementation and validation.
