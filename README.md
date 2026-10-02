# THE SIGNAL

**PRESS PLAY. SURVIVE.**

A retro arcade space shooter that lives inside a broken TV. Dodge, shoot and survive through escalating waves while the signal itself starts to fall apart around you, then face the creatures that are broadcasting it.

Built with plain HTML, CSS and JavaScript on a single `<canvas>`. No frameworks, no build step, no dependencies.

> **[▶ Play it here](https://H0SS31N.github.io/the-signal/)**

---

## About the game

You pilot a lone ship against a hostile transmission. Waves of enemies come in faster and harder the longer you stay alive. Every few waves the broadcast takes a face and a voice: a boss fight with its own music, its own attacks and its own things to say to you.

The whole game is dressed as a damaged VHS broadcast: scanlines, RGB split, tracking noise and screen tears. After wave 2 the signal itself becomes unstable and the environment shifts with it.

### Features

- **Endless wave survival.** Each wave lasts 64 seconds and the difficulty keeps climbing.
- **4 bosses** that cycle as you progress, one every 3 waves, each with its own health, attack speed and dialogue:
  - **The Watcher**
  - **The Mouth**
  - **The Dial**
  - **The Broadcaster**
- **Elite enemies** that take more hits and are worth more points.
- **Power-ups** dropped by enemies:
  - **+** restores 1 health (max 5)
  - **A** adds 1 armor (max 3)
  - **2X** gives double shot for 12 seconds
- **Alt move.** Destroying enemies charges a meter. When it is full, press `E` to release a screen-wide shockwave that wipes out normal enemies and damages elites and bosses.
- **Environment shifts** every 2 waves, with new colors and a new frequency.
- **Two soundtracks.** The main theme plays normally and a separate boss theme takes over during boss fights.
- **VHS / CRT look.** Scanlines, vignette, film noise, color wash, tracking lines and signal tears, all done in CSS and canvas.
- **High score saved** in your browser with `localStorage`.

## Controls

| Action | Keys |
| --- | --- |
| Move | `W` `A` `S` `D` or Arrow keys |
| Fire | `Space` |
| Alt move (when charged) | `E` |
| Pause | `P` |
| Mute / unmute music | `M` |

## Run it locally

No install needed. Download or clone the repo and open `index.html` in any modern browser.

```bash
git clone https://github.com/YOUR-USERNAME/the-signal.git
cd the-signal
```

Then open `index.html`, or serve the folder if you prefer:

```bash
python3 -m http.server 8000
```

and visit `http://localhost:8000`.

## Music

The game expects two audio files in a `music/` folder:

```
music/the-signal-theme.mp3
music/boss-theme.mp3
```

If they are missing the game still runs, just without sound. Browsers also block audio until you interact with the page, so music starts when you press **PLAY**.

## Project structure

```
the-signal/
├── index.html      page layout, start and game over screens
├── style.css       layout and the VHS / CRT visual effects
├── game.js         all game logic, rendering and audio
└── music/
    ├── the-signal-theme.mp3
    └── boss-theme.mp3
```

## Status

**V0.1 beta.** Work in progress, so expect rough edges, balance changes and new content.

## Credits

Created by **H0SS31N**.
