# AI Coworker — 13-Agent Workflow

Welcome! This directory contains the **AI Coworker**, a powerful multi-agent system designed to act as your autonomous product development team.

## Overview
This workflow uses different specialized AI agents (like Product Manager, Architect, Frontend, Backend, Debugger, etc.) that pass work to each other using shared memory files. It's built to take a raw idea and output production-ready, fully tested code.

## How to Use It (The Short Version)

1. **Set up the context**: Give the AI the `Master_prompt.md` to start your session. It will load all agent personas.
2. **Phase 1: Temporary Context**:
   - Give the AI your initial ideas. It will output a `temporary_project_context.md`.
3. **Phase 2: Ideation & Planning**:
   - Run the planning agents (`@PM` → `@GUARD` → `@ARCH` → `@DESIGN`). They will use the temporary context to define requirements, risks, architecture, and UI/UX.
4. **Phase 3: Final Context**:
   - Once planning is complete, the AI generates a `final_project_context.md`. This becomes the single source of truth for the entire build phase.
5. **Phase 4: Execution (Build Phase)**:
   - Pass the Final Project Context to the building agents (`@FE` and `@BE`) using the **GSD (Get Sh*t Done)** methodology.
6. **Phase 5: QA & Gates**:
   - Run the code through the hard gates (`@SEC`, `@ETHICS`, `@QA`) before deployment.
7. **Phase 6: Deploy & Maintain**:
   - Use `@OPS` to deploy. Provide logs to `@DATA` for analytics, and test failures to `@DEBUGGER`.

## The Agents
- `@PM` (Product Manager) - Defines requirements (PRD).
- `@GUARD` - Checks PRD for critical risks.
- `@ARCH` - Plans the system architecture.
- `@DESIGN` - Creates UI/UX design tokens and flows.
- `@FE` / `@BE` - Frontend and Backend Engineers (the builders).
- `@SEC`, `@ETHICS`, `@QA` - The "Gates" that audit the code for security, ethics, and quality.
- `@OPS` - Deploys to staging/production.
- `@DATA` - Analyzes post-launch metrics.
- `@DEBUGGER` - The elite incident-response agent for fixing logical bugs and RCA.
- `@REPAIR` - Surgical syntax, compiler, lint, and TypeScript type error corrector.

**To get started, read `PLAYBOOK.md`—it shows you the exact copy-paste commands to orchestrate these agents successfully.**

---

## Recent Updates

- **Dedicated `@REPAIR` Agent**: Added a reactive, on-demand code repair specialist (`Error_corrector.md`) to resolve syntactic, compiler, dependency, type, and linting errors surgically.
