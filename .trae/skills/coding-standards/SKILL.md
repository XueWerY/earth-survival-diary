---
name: "coding-standards"
description: "Enforces 4 coding principles: think before coding, keep it concise, make precise changes, goal-driven execution. Invoke when user requests any coding, refactoring, or bug-fixing task."
---

# Coding Standards

This skill enforces four core coding principles that must be followed for ALL coding tasks.

## Core Principles

### 1. Think Before Coding
**No assumptions, no avoidance of questions, clarify trade-offs clearly.**

Before writing any code:
- Clearly list all your assumptions; actively confirm if there are any doubts.
- If the requirement has multiple interpretations, list them all; do not privately choose one.
- If a simpler implementation exists, proactively propose it; dare to raise objections when necessary.
- If anything is unclear, pause development, explicitly point out the confusion, and ask.

### 2. Keep It Concise
**Solve the problem with minimal code, no assumed content.**

- Do not develop features beyond requirements.
- For code used only once, do not abstract or encapsulate it.
- Do not implement unrequested extensibility or configurability features.
- Do not write exception handling logic for scenarios that cannot occur.
- If 200 lines can be reduced to 50 lines while achieving the same functionality, you MUST refactor and simplify.

Self-check: **Would a senior engineer consider this design overly complex?** If yes, simplify further.

### 3. Make Precise Changes
**Only change what is necessary, clean up only the redundancy caused by your changes.**

When modifying existing code:
- Do not optimize surrounding code, comments, or formatting.
- Do not refactor code that is working properly.
- Follow the existing code style, even if you know a better way.
- If you find unrelated unused code, only note it; do not delete it.

If your changes create dead code:
- Delete imports, variables, and functions that are no longer used due to YOUR changes.
- Do not delete pre-existing unused code unless asked.

Verification: Every line of modified code must directly correspond to a user requirement.

### 4. Goal-Driven Execution
**Define completion criteria, iterate and verify until met.**

Transform tasks into verifiable goals:
- "Add validation logic" → "Write test cases for invalid inputs, then implement code to pass them"
- "Fix a bug" → "Write a reproducible test case, then fix the issue and verify the test passes"
- "Refactor module X" → "Ensure all existing tests pass before and after refactoring"

For multi-step tasks, briefly list the execution plan:
```
1. [Step] → Verification: [What to check]
2. [Step] → Verification: [What to check]
3. [Step] → Verification: [What to check]
```

## When to Apply

Apply these principles to EVERY coding task, including:
- Writing new features
- Fixing bugs
- Refactoring code
- Code reviews
- Any code modification

## Enforcement

You MUST follow these principles in ALL code-related interactions. No exceptions.
