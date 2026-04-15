# Content System

## Goal

The prototype content is no longer meant to live inside React components.

It is now split into:

- **math progression**: the learning path
- **scene configuration**: the playable content skeleton
- **AI expansion space**: the parts that can be safely expanded later

## Files

- `content/math-progression.ts`
  - defines the math-thinking progression stages
- `content/scenes.ts`
  - defines the current playable scene skeletons for each mode
- `content/tasks.ts`
  - defines task-level routing and shell information

## Current math progression

1. `观察与计数`
2. `模式与策略`
3. `规则构建`
4. `因果推理`

## Scene structure

Each scene includes:

- scene id
- mode
- intro text
- child-facing goal
- adult-facing note
- skill tags
- AI expansion prompt

Mode-specific fields:

- opponent
  - action labels
  - voice prompt
- co-create
  - starter rules
  - fragments
  - input placeholder
- story
  - choice sets

## Multi-scene rollout

Each mode now supports more than one playable scene skeleton.

- `opponent`
  - `moonstone_balance`
  - `lantern_steps`
- `co-create`
  - `explain_before_move`
  - `swap_the_winner`
- `story`
  - `mist_town_route`
  - `clock_tower_signal`

The child-facing default flow still enters the default scene directly.
Alternative scenes are only exposed inside a folded "for adults" switcher so
playtests can compare content without making the main play surface noisier.

## AI expansion rule

Later, real AI should only expand:

- dialogue variation
- challenge follow-up
- short narrative detail
- TTS text variation

AI should not freely change:

- progression stage
- scene objective
- branch structure
- reward hook meaning
- safety boundaries

## Why this matters

This keeps the experience:

- structured for a 7-year-old child
- measurable across playtests
- expandable without rewriting UI code
