# Claude Opus 4.6 Prompting — Quick Reference

Condensed from Anthropic's official prompting best practices.
Used by the prompt-engineer skill as a reference lookup.

---

## Core principles

| Principle | What to do |
|---|---|
| Be explicit | Say exactly what you want. Don't rely on Claude to infer intent. |
| Give context | Explain *why* — Claude generalizes better with motivation. |
| Use examples | 3–5 examples in `<examples>` tags beat lengthy instructions. |
| Use XML tags | Wrap each type of content: `<instructions>`, `<context>`, `<examples>`, `<input>` |
| Set a role | One sentence in system prompt. "You are a senior engineer who..." |
| Define success | Tell Claude how to verify it's done before it finishes. |

---

## Output format control

To get prose instead of bullets:
> "Write the response in smoothly flowing prose paragraphs."

To suppress markdown:
> "Do not use markdown. No bold, headers, or bullet points."

To minimize overengineering:
> "Only make changes directly required. Keep solutions simple and focused. Do not add
> abstractions or documentation beyond what is asked."

---

## Claude Opus 4.6 behavior flags

| Behavior | Prompt fix |
|---|---|
| Takes more action than asked | Add explicit scope constraints to `<constraints>` |
| Overengineers / adds extras | "Only implement what is directly requested." |
| Runs steps in parallel when you need sequential | "Complete each step fully before starting the next." |
| Stops early near context limit | "Save progress and continue. Do not stop early." |
| Makes risky changes without asking | "Ask for confirmation before irreversible actions." |
| Suggests instead of implements | "Implement the changes, do not only suggest them." |

---

## Long-context best practices

- Put long documents and file contents **at the top** of the prompt, above instructions
- Wrap multi-file inputs in `<document index="N">` tags with `<source>` subtags
- Ask Claude to quote relevant sections before acting: "Quote the relevant section
  first, then make your change."

---

## Agentic / multi-step tasks

For tasks spanning multiple context windows:
- Ask Claude to write a `progress.md` or `tests.json` and update it as it works
- Instruct: "Review progress.md and git logs before continuing."
- Use git as state: "Commit after each logical step."
- For verification: "Run the integration test suite before marking complete."

---

## Factory Droid–specific

| Pattern | How |
|---|---|
| Focus on a file | Use `@filename` in your prompt |
| Share project conventions | Reference `AGENTS.md` |
| Limit scope | "Only modify files in src/X/" |
| Plan before implement | "Use Specification Mode" at start of prompt |
| Phase a big feature | Send one phase per session: schema → API → UI |
| Trigger subagent explicitly | "Run the subagent `droid-name` on this task" |
