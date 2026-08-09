# HADAL

A blind-navigation sonar game. You pilot a small submersible through pitch-black
cave systems where nothing is visible until you ping it — and pinging near
danger wakes it up.

Open `index.html` in a browser to play. No build step, no dependencies.

## Controls

- `W A S D` / arrow keys — thrust
- `Space` — fire a sonar ping

## The loop

- The cave is invisible by default. Firing a ping sends an expanding wave that
  briefly lights up rock, pearls, oxygen pods, and creatures it passes over —
  the light fades a few seconds later, so you're navigating from memory as
  much as sight.
- Sonar energy recharges on its own; oxygen only drains, so oxygen pods are
  the real bottleneck.
- Things living in the dark are mostly asleep. A ping that reaches one wakes
  it, and it will hunt toward you for a few seconds before settling back down.
- Find the beacon to descend to the next depth (harder, tighter caves, more
  woken things). Pearls are the score. Three hull hits and the run ends.

Built as a single self-contained `index.html` — plain canvas + Web Audio,
no external assets or fonts.
