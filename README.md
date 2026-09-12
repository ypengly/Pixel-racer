# PIXEL RACER — Classic Pocket Racing

A top-down, pixel-art arcade racer inspired by early-2000s Nokia/Java mobile
games. Built with plain HTML5 Canvas + vanilla JavaScript — no build step,
no dependencies, runs straight from `index.html`.

**[Play it]** — open `index.html` in any modern browser (see *How to run
locally* below).

---

## 1. Project overview

You pick a car in the garage, choose one of five tracks, and race three laps
against four AI opponents. Progress (tracks + cars) and high scores persist
between sessions via `LocalStorage`. The whole game renders to a fixed
240×320 internal canvas — the same portrait resolution a Nokia-era handset
screen might have used — then scales that canvas up to fit whatever screen
it's running on, without ever distorting the aspect ratio.

## 2. Features

- 5 hand-built tracks (oval, city, desert, snow, night circuit), each with a
  different surface, obstacle set, and challenge (narrow corners, slippery
  ice, low visibility…)
- Arcade car physics with drifting, off-road slowdown, and per-surface grip
- 4 AI opponents with distinct personalities (Balanced / Fast / Aggressive /
  Slow & Steady), simple lookahead steering, occasional "mistakes"
- Nitro meter, shield / repair / coin power-ups, static hazards (cones,
  tires, oil, rocks, barrels)
- Lap counter, live position, race timer, particle effects, screen shake
- Garage with 4 unlockable cars (different speed/accel/handling/nitro
  stats), unlocked by winning races
- Track progression (win a race to unlock the next track)
- Arcade-style high-score table with 3-letter initials entry
- Fully synthesized retro sound effects (WebAudio oscillators/noise — no
  external audio files, so nothing here is copyrighted music)
- Keyboard, mouse and on-screen touch controls; responsive scaling for
  desktop, tablet and mobile

## 3. Controls

| Action | Keyboard | Touch |
|---|---|---|
| Accelerate | `↑` / `W` | ▲ button |
| Brake / Reverse | `↓` / `S` | ▼ button |
| Steer | `←` `→` / `A` `D` | ◀ ▶ buttons |
| Nitro boost | `Space` | N button |
| Menu navigate | `↑` `↓` `←` `→` | tap |
| Menu confirm / back | `Enter` / `Esc` | tap |

## 4. Architecture

Everything is plain ES2017 classes/objects loaded as ordinary `<script>`
tags (no bundler, no modules — this keeps it runnable straight from
`file://` with zero setup). Load order in `index.html` doubles as the
dependency graph:

```
constants.js        shared config + math helpers
save.js              SaveManager      - all LocalStorage reads/writes
audio.js             AudioManager     - synthesized SFX + engine hum
particleSystem.js    ParticleSystem   - smoke/sparks/exhaust/confetti
input.js             InputManager     - keyboard + touch -> one input state
track.js             track geometry helpers + the 5 track definitions
trackManager.js      TrackManager     - owns tracks + unlock progression
car.js               Car              - shared arcade physics/rendering
playerCar.js         PlayerCar        - reads InputManager
aiCar.js             AICar            - path-following AI + personalities
collisionManager.js  CollisionManager - walls / obstacles / car-vs-car
powerUp.js           PowerUp          - pickup effects + icon/obstacle art
scoreManager.js      ScoreManager     - turns race stats into a score
raceManager.js       RaceManager      - countdown, grid, standings, finish
uiManager.js         UIManager        - every DOM menu/HUD/results screen
game.js              Game             - state machine + canvas rendering
main.js              entry point, responsive scaling, bootstraps Game
```

Gameplay logic (everything above `uiManager.js`) never touches the DOM.
`UIManager` never touches game state directly — `Game` is the only class
that talks to both sides, which keeps the simulation testable in isolation
(see *What I learned*, below).

## 5. The game loop

`Game._loop(now)` runs on `requestAnimationFrame` and does the classic:

```
input -> update -> physics -> collision -> AI -> particles -> render
```

Delta time is measured every frame and clamped (`CONFIG.MAX_STEP`) so a
dropped frame (tab switch, GC pause) can't fling a car across the map —
all motion is expressed as *units per second*, not *units per frame*.

## 6. Physics

Each `Car` stores a position, a facing angle, and a scalar `speed` along
that facing direction. Throttle/brake change `speed`; steering rotates the
facing angle (scaled down at low speed, so the car doesn't spin in place).
The actual velocity vector is then *blended* toward
`forward * speed` every frame by a `grip` factor:

```js
this.vx = lerp(this.vx, desiredVx, blend);
this.vy = lerp(this.vy, desiredVy, blend);
```

With grip near 1 the car's velocity snaps to its facing direction almost
immediately (a "safe" arcade feel). Drop grip — off-road, on ice, in an
oil slick — and the old velocity is retained for longer, which is what
produces sliding/drifting with almost no extra code. Track surface (road /
grass / sand / snow) is looked up every frame by finding the nearest point
on the track's centerline and comparing distance to `roadWidth / 2`.

## 7. Collision detection

- **Track boundary**: if a car strays more than `roadWidth/2 + shoulder`
  from the nearest centerline point, it's clamped back to that radius and
  its velocity is reflected off the boundary normal (`bounceOffBarrier`).
- **Obstacles**: simple circle-vs-circle tests against each obstacle;
  solid ones push the car out and cut its speed, oil slicks instead grant
  a temporary "slide" (a grip penalty) without any positional correction.
- **Cars vs cars**: circle-vs-circle with a soft positional + velocity
  correction so cars separate instead of overlapping.
- A short per-car `collisionCooldown` stops a single overlap from
  re-triggering the same impact (and its sound/particles) every frame.

## 8. AI system

The AI is deliberately simple and reliable rather than clever: every frame
each `AICar` looks at a point on the track's centerline a little ahead of
itself (further ahead at higher speed), steers toward it, and eases off
the throttle when the road curves away sharply just ahead. A slowly
drifting "lane offset" makes cars weave across the road width, which reads
as overtaking attempts without any real path-planning. Personality (`speed
multiplier`, `mistake chance`, `lane-change rate`) is just a few numbers
layered on top of that one behavior.

## 9. LocalStorage

All persistence goes through `SaveManager` (`save.js`) under a single
namespaced key, so nothing else in the game touches `localStorage`
directly:

- unlocked tracks / cars, currently selected car
- total race wins (used to unlock cars)
- sound on/off
- top-5 high scores

## 10. How to run locally

No build step, no server required for basic play:

```
open index.html         # macOS
start index.html        # Windows
```

If your browser blocks `file://` script loading, serve the folder instead:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## What I learned

**Arcade "feel" is a blending problem, not a force problem.** My first pass
at the car physics used real acceleration/friction forces and it felt
sluggish and floaty — closer to a boat than a Nokia racer. Swapping to
"blend current velocity toward the car's forward direction by a grip
factor" made drifting, snappy turning, and surface-dependent handling fall
out of one line of code instead of a small physics engine.

**A single source of truth for "where am I on the track" simplifies
everything downstream.** Once every car tracks its nearest centerline
index each frame, lap counting, standings/position, AI steering targets,
and surface detection all become simple lookups against that one number,
instead of four separate systems each re-deriving track position their own
way.

**Decoupling simulation from presentation paid off immediately.** Because
`Car`/`AICar`/`RaceManager`/`CollisionManager` never touch the DOM, I could
headlessly simulate full races in a plain Node script (no browser) while
building this, driving hundreds of simulated frames per track to catch
NaNs and stuck-car bugs long before ever opening it in a browser.

**Responsive pixel-art is a scaling-context problem.** Rather than
recalculating dozens of hard-coded pixel sizes for the UI on every resize,
setting a single `font-size` on the game's outer container (derived from
how much the 240×320 canvas got scaled up) and expressing every UI
measurement in `em` gets the whole interface — text, bars, buttons — to
scale together, in one place, for free.
