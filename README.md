# Starfence

A territory-claiming arcade game in plain HTML and JavaScript, in the spirit of the Amiga-era Qix/Volfied style of game, with its own enemies, sectors and pictures.

## Play

Double-click `index.html`. No server, build step or install needed.

| Key | Action |
| --- | --- |
| Arrow keys / WASD | Move |
| Enter (or click) | Start |
| P / Esc | Pause |
| M | Sound on/off |

## Rules

- Your ship travels along the glowing edge of the field. Moving into the dark field draws a line.
- Join the line back up to the edge and everything on the side **without the boss** is claimed, uncovering part of a hidden picture.
- While you're drawing, any enemy touching your ship **or your line** costs a life. You can't turn back over your own line, and boxing yourself in with nowhere to go also costs a life.
- Sparks patrol the edge from sector 2 onwards and can hit you anywhere.
- Claim the target percentage (75% rising to 85%, shown as the white mark on the HUD bar) to clear the sector.
- Small enemies caught in a claimed area are destroyed (+500).
- Trap a **?** box inside a claim for a power-up: speed up, freeze, shield, slow enemies, smart bomb or extra life.
- Extra life every 25,000 points. The high score is saved in the browser.

## Sectors

Eight sectors, each with its own boss and picture. After sector 8 they repeat, faster and with higher targets.

| Boss | Behaviour |
| --- | --- |
| Orb | Big and slow, bounces around |
| Serpent | A head with a long body; every segment is dangerous |
| Spinner | Drifts slowly and fires rings of bullets |
| Hunter | Wanders, then chases you while you're drawing |

Small enemies: **drifter** (bounces diagonally), **zigzag** (sideways, flips up/down on a beat), **looper** (circles), **seeker** (slow, steers towards you while you draw).

## Tests

```
npm install
npm test
```

Runs a headless-Chrome smoke test (needs Chrome installed at the default path) that plays through the core rules, every sector and a game over, and saves screenshots to `tests/shots/`.
