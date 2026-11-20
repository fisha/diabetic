---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the vendored guidelines in `guidelines.md` (next to this file)
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in `guidelines.md`
4. Output findings in the terse `file:line` format

## Guidelines Source

Stedio vendors a pinned copy of the guidelines in `guidelines.md` (from
github.com/vercel-labs/web-interface-guidelines `command.md`, commit 434b7f9, 5 Oct 2026). Read that file; do not
fetch the remote copy at run time. To update it, follow `.claude/skills/README.md`.

## Usage

When a user provides a file or pattern argument:
1. Read `guidelines.md`
2. Read the specified files
3. Apply all rules from `guidelines.md`
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
