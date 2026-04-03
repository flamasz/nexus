---
description: Generate a complete Claude Opus prompt for a task in this codebase
argument-hint: <describe what you want to prompt the droid to do>
---

Use the subagent `prompt-engineer` to write a complete, production-ready prompt for
the following task:

$ARGUMENTS

The subagent should:
1. Read AGENTS.md and any relevant files for context before writing
2. Output a complete prompt with <role>, <task>, <context>, <constraints>, and <verification>
3. Include scope limits so Claude Opus doesn't over-engineer
4. End with a concrete, runnable verification step

When done, show me the full prompt so I can review and use it.
