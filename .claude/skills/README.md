# Vendored agent skills

`regulatory-check` and `privacy-compliance` are Stedio's own skills. Everything else here is a third-party skill,
read before it was copied in (PM-326, 20 Nov 2026, from the article "9 Best UI Skills for Claude Code in 2026").

The project rules always win over these skills: `CLAUDE.md`, the handoff brief, the design in
`design/claude-design/` (which decides the look), the regulatory and privacy checks, and Guy's approval before
anything is built. These skills are for design review and craft; they never add screens, flows or dependencies on
their own.

| Skill(s) | Source | Commit | Licence | Local changes |
|---|---|---|---|---|
| `frontend-design` | github.com/anthropics/skills | e4bb5d9 (16 Nov 2026) | Apache-2.0 | none |
| `webapp-testing` | github.com/anthropics/skills | e4bb5d9 | Apache-2.0 | none (`scripts/with_server.py` starts the servers you pass it) |
| `ui-ux-pro-max` | github.com/nextlevelbuilder/ui-ux-pro-max-skill (`.claude/skills/ui-ux-pro-max`) | 2de1134 (19 Nov 2026) | MIT | Script path changed from `${CLAUDE_PLUGIN_ROOT}/...` to `.claude/skills/ui-ux-pro-max/scripts/search.py` (run from the repo root). Left out `validate_data.py` (fetches Google Fonts metadata) and `scripts/tests/`. The kept scripts are local Python only (csv, no network). The sibling skills in that repo (banner-design, brand, slides, design, ui-styling, design-system) are not vendored. |
| `taste-skill` (design-taste-frontend) | github.com/Leonxlnx/taste-skill | f6b7657 (7 Nov 2026) | MIT | Only `SKILL.md` and `references/`. The ~40 MB `assets/` component library (HTML/JS/shaders/images for landing pages) is left out; a note at the top of SKILL.md says so. |
| `impeccable` | github.com/pbakaus/impeccable (`.claude/skills/impeccable`) | b49177d (18 Nov 2026) | Apache-2.0 | Only `SKILL.md` and `reference/`. `scripts/` is left out: its launcher downloads and runs a platform binary on first use. A note at the top tells agents to use the skill's own "Launcher unavailable" path. |
| `animate`, `animate-expo`, `animation-performance`, `animation-vocabulary`, `apple-design`, `ask-emil`, `ask-sonner`, `break-ui`, `choreograph`, `emil-design-eng`, `find-animation-opportunities`, `gestures`, `improve-animations`, `learn-taste`, `mobile-native`, `pick-ui-library`, `prototype`, `remove-animations`, `review-animations`, `write-swift` | github.com/emilkowalski/skills | 64eb3de (15 Nov 2026) | MIT | none |
| `interface-design` (+ `.claude/commands/interface-design/design-review.md`, `design-deslop.md`) | github.com/Dammyjay93/interface-design | 2f9be32 (20 Jun 2026) | MIT | `agents/openai.yaml` left out (Codex metadata). |
| `web-design-guidelines` | github.com/vercel-labs/agent-skills | 1a2c79d (27 Oct 2026) | MIT | The skill fetched its rules from GitHub on every run. A pinned copy is vendored as `guidelines.md` (github.com/vercel-labs/web-interface-guidelines `command.md`, 434b7f9, 5 Oct 2026) and SKILL.md reads that file instead. |

Not vendored:

- **shadcn/ui skill** (github.com/shadcn-ui/ui `skills/shadcn`): neither the website nor the app uses shadcn/ui (no
  `components.json`, no Radix/Tailwind; the app is React Native). The skill's main job is running
  `npx shadcn@latest` to add components, which would bring in a new UI library the design does not use.

Overlaps to keep in mind: `animate-expo` overlaps the app repo's `expo-animation`; `ui-ux-pro-max` and `taste-skill`
are both style engines (the article recommends using one). For app screens prefer `interface-design`,
`ui-ux-pro-max`, `impeccable` (critique, audit.native, ios, android), `apple-design` and `emil-design-eng`.

Updating: clone the source at a new commit, read the diff, re-apply the local changes above, and update this table.
