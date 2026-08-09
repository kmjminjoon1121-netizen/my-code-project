# MAW

A bullet-hell boss fight against an abyssal anglerfish. Movement is the whole
game — your submersible fires automatically, so all you have to do is not get
hit by the only thing that can kill you: a tiny dot at the center of your hull.

Open `index.html` in a browser to play. No build step, no dependencies.

## Controls

- `W A S D` / arrow keys — move
- `Shift` — focus mode (slower, precise movement; shows your exact hit-radius)
- `Space` — bomb (clears the screen, damages the boss, brief invincibility)

## The loop

- MAW cycles through attack patterns — ring bursts, aimed spreads, spirals,
  homing spores, a telegraphed laser sweep. Every pattern's name is announced
  a beat before it starts, so you always get a read before it gets dangerous.
- Your hitbox is a small bright core, much smaller than your sprite — only
  that core counts.
- Stay under the boss to land your automatic fire; drift off to dodge. That's
  the whole tension.
- Beating a wave heals a bomb back and starts a tougher, faster MAW. Three
  hits and the run ends; score comes from damage dealt and close grazes.

Built as a single self-contained `index.html` — plain canvas + Web Audio,
no external assets or fonts.
