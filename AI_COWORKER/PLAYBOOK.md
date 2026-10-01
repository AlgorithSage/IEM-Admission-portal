# AI Coworker — Operational Playbook

> **How to actually make the AI follow your agent architecture.**
> Read this before starting any project.

---

## The Reality

Your agent files (`@PM`, `@ARCH`, `@FE`, etc.) are **system prompts** — they tell an AI *how to behave*. But no AI automatically reads them. **YOU** are the orchestrator. You run each agent by:

1. Pasting the right role file as the system prompt (or first message)
2. Giving it the right input (from previous agents)
3. Saving its output to the right place
4. Moving to the next agent in the pipeline

This playbook shows you exactly how.

---

## Method 1: Single-Session Mode (Recommended for Most Work)

### The Master Prompt Approach

Instead of running 11 separate sessions, paste the **Master Prompt** (see `Master_prompt.md`) at the start of ONE chat session. This gives the AI awareness of:
- The full pipeline order
- All agent roles (summarized)
- The shared memory structure
- The gate system
- GSD methodology

**Then you direct it through phases:**

```
You:  "Act as @PM. Here's my project idea: [description]"
AI:   [produces PRD]
You:  "Now act as @GUARD. Review the PRD for risks."
AI:   [produces risk report]
You:  "Now act as @ARCH. Design the system architecture."
AI:   [produces architecture]
...and so on
```

**Pros:** Fast, no context switching, natural flow.
**Cons:** Context window fills up — works for small/medium projects.

---

### When to Use Single-Session vs Multi-Session

| Project Size | Approach | Why |
|-------------|----------|-----|
| Small (1-2 features) | Single session + Master Prompt | Fits in one context window |
| Medium (3-5 features) | Single session for planning (@PM → @ARCH → @DESIGN), then separate sessions per feature for building (@FE, @BE) | Planning is lightweight, building is heavy |
| Large (6+ features) | Multi-session for everything | Each agent needs full context for its domain |

---

## Method 2: Multi-Session Mode (For Large Projects)

### Session Flow

Each session = one agent. You manually carry the output forward.

```
SESSION 1: @PM
├── Input:  Your project idea
├── Prompt: Paste product_manager.md content as system prompt
├── Output: PRD (save to shared_memory/prd/PRD.md)
│
SESSION 2: @GUARD
├── Input:  shared_memory/prd/PRD.md
├── Prompt: Paste Guard.md content as system prompt
├── Output: Risk report (save to shared_memory/logs/risk_report.md)
│
SESSION 3: @ARCH
├── Input:  shared_memory/prd/PRD.md
├── Prompt: Paste System_architect.md content as system prompt
├── Output: Architecture doc (save to shared_memory/architecture/ARCHITECTURE.md)
│
SESSION 4: @DESIGN
├── Input:  shared_memory/prd/PRD.md + architecture summary
├── Prompt: Paste UI_UX_designer.md content as system prompt
├── Output: Design system (save to shared_memory/design/DESIGN_SYSTEM.md)
│
SESSION 5: @FE
├── Input:  shared_memory/design/ + shared_memory/architecture/
├── Prompt: Paste Frontend_engineer.md content as system prompt
├── Output: Frontend code (actual code files)
│
SESSION 6: @BE
├── Input:  shared_memory/architecture/
├── Prompt: Paste Backend_engineer.md content as system prompt
├── Output: Backend code (actual code files)
│
SESSION 7: @SEC
├── Input:  All code from @FE + @BE
├── Prompt: Paste cybersec_expert.md content as system prompt
├── Output: Security report (save to shared_memory/security/SECURITY_AUDIT.md)
│
SESSION 8: @ETHICS
├── Input:  PRD + architecture + backend code
├── Prompt: Paste Ethics_compliance.md content as system prompt
├── Output: Compliance report (save to shared_memory/compliance/COMPLIANCE.md)
│
SESSION 9: @QA
├── Input:  PRD + all code
├── Prompt: Paste QA_automation_engineer.md content as system prompt
├── Output: Test suite + QA report (save to shared_memory/tests/QA_REPORT.md)
│
SESSION 10: @OPS
├── Input:  Tested code + QA report
├── Prompt: Paste DevOPS.md content as system prompt
├── Output: CI/CD + deployment config
│
SESSION 11: @DATA (post-launch)
├── Input:  Deployment logs
├── Prompt: Paste Data_analyst.md content as system prompt
├── Output: Analytics insights

SESSION 12: @DEBUGGER (incident response)
├── Input:  Error logs, broken backend/frontend code, QA test failures
├── Prompt: Paste elite_debugger.md content as system prompt
├── Output: RCA and fixed code (save to shared_memory/incident_reports/RCA_REPORT.md)
│
SESSION 13: @REPAIR (syntactic & type repair)
├── Input:  Compiler error logs, lint warnings, tsc diagnostics, syntax failures
├── Prompt: Paste Error_corrector.md content as system prompt
├── Output: Surgical code fixes (save to shared_memory/incident_reports/REPAIR_LOG.md)
```

---

## Method 3: Hybrid Mode (Best of Both — Recommended for Real Work)

### Phase 0: Context Initialization (NEW)

1. Write down your raw thoughts. The AI formats this into `temporary_project_context.md`.

### Phase 1: Planning Phase (Single Session)

One session with Master Prompt:
```
"Act as @PM → @GUARD → @ARCH → @DESIGN in sequence using the temporary project context."
```

Save all outputs to `shared_memory/`. Once complete, the AI will package all these decisions into `final_project_context.md`. This becomes the absolute source of truth for the rest of the project.

### Phase 2: Build Phase (Separate Sessions per Feature)

For each feature/module, open a dedicated session:
```
System prompt: Frontend_engineer.md
Input: "Here is the final_project_context.md. Build [Feature X]."
Attach: shared_memory/final_project_context.md + shared_memory/design/ + shared_memory/architecture/
```

### Phase 3: Gate Phase (Single Session)

One session for all gates:
```
"Act as @SEC → @ETHICS → @QA in sequence. Here's the code:"
```

### Phase 4: Deploy Phase (Separate Session)

```
System prompt: DevOPS.md
Input: "All tests passed. Deploy this."
```

---

## How to Paste the Agent Prompt

### Option A: System Prompt (Best)
If your AI tool supports custom system prompts (Claude Projects, GPT Custom Instructions, Gemini Gems):
1. Copy the **entire content** of the agent `.md` file
2. Paste it as the system/custom instruction
3. Start chatting normally

### Option B: First Message (Universal)
Works with any AI:
```
I want you to follow these exact instructions as your operating rules:

[paste entire agent .md file content here]

---

Now, here is my task:
[your actual request]
```

### Option C: Master Prompt + Role Switch (Fastest)
Paste `Master_prompt.md` once, then switch roles mid-conversation:
```
"Switch to @ARCH mode. Design the backend architecture for this PRD."
```

---

## Shared Memory: How to Actually Maintain It

Create this folder structure in your project:

```
your-project/
├── shared_memory/
│   ├── temporary_project_context.md ← Initial raw ideas
│   ├── final_project_context.md    ← Single source of truth for builders
│   ├── prd/
│   │   └── PRD.md              ← @PM output
│   ├── architecture/
│   │   └── ARCHITECTURE.md     ← @ARCH output
│   ├── design/
│   │   └── DESIGN_SYSTEM.md    ← @DESIGN output
│   ├── frontend/
│   │   └── PROGRESS.md         ← @FE status tracking
│   ├── backend/
│   │   └── PROGRESS.md         ← @BE status tracking
│   ├── security/
│   │   └── SECURITY_AUDIT.md   ← @SEC output
│   ├── compliance/
│   │   └── COMPLIANCE.md       ← @ETHICS output
│   ├── tests/
│   │   └── QA_REPORT.md        ← @QA output
│   ├── deployment/
│   │   └── DEPLOY_LOG.md       ← @OPS output
│   ├── incident_reports/
│   │   ├── RCA_REPORT.md       ← @DEBUGGER output
│   │   └── REPAIR_LOG.md       ← @REPAIR output
│   └── logs/
│       └── PIPELINE_LOG.md     ← Running log of all agent outputs
├── src/                        ← Actual code
├── GSD/                        ← Copy from AI_COWORKER/GSD/
└── ...
```

**Rule:** After every agent session, save its output to the correct `shared_memory/` subfolder. This is how agents "communicate" across sessions.

---

## Using GSD During Build Phase

When building features (@FE, @BE), invoke GSD commands:

```
Step 1: "Use GSD /plan to break this feature into phases"
        → AI creates .gsd/ROADMAP.md with phases

Step 2: "Use GSD /execute phase 1"
        → AI implements phase 1 with wave-based execution

Step 3: "Use GSD /verify"
        → AI proves each task with empirical evidence

Step 4: "Use GSD /pause"
        → AI dumps state to .gsd/STATE.md (for next session)

Next session:

Step 5: "Use GSD /resume"
        → AI picks up from STATE.md
```

---

## Gate Enforcement: How to Actually Block Bad Code

The gates are only enforced if **you enforce them.** Here's how:

### Before Deploying, Always Run:

```
1. "Act as @SEC. Here is my codebase: [attach code]. Audit it."
   → If approval_status = false → FIX BEFORE CONTINUING

2. "Act as @ETHICS. Here is the PRD and data flow: [attach]. Audit it."
   → If approval_status = false → FIX BEFORE CONTINUING

3. "Act as @QA. Here is the PRD and code: [attach]. Test it."
   → If overall_status = FAIL → FIX BEFORE CONTINUING
```

**Only deploy if all 3 gates pass.**

---

## Quick Start Checklist

Starting a new project? Follow this:

```
□ 1. Create project folder
□ 2. Copy GSD/ folder into project
□ 3. Create shared_memory/ folder structure (see above)
□ 4. Open AI session with Master Prompt (or @PM prompt)
□ 5. Describe your project idea and generate `temporary_project_context.md`
□ 6. Run @PM → save PRD to shared_memory/prd/PRD.md
□ 7. Run @GUARD risk check
□ 8. Run @ARCH → save architecture
□ 9. Run @DESIGN → save design system
□ 10. Generate `final_project_context.md` combining all plans
□ 11. Run @FE + @BE with GSD /plan → /execute → /verify (using final context)
□ 12. Run @SEC + @ETHICS + @QA gates
□ 13. Run @OPS to deploy
□ 14. Run @DATA for post-launch analytics
```

---

## Common Mistakes to Avoid

| Mistake | Why It Fails | Do This Instead |
|---------|-------------|-----------------|
| Skipping @GUARD | You build first, find risks later | Always run risk check on PRD |
| No shared_memory files | Next agent session has no context | Save every output immediately |
| Skipping gates (@SEC, @ETHICS, @QA) | Ship insecure/non-compliant code | Always run all 3 before deploy |
| One huge session for everything | Context window fills, quality drops | Split planning vs building |
| Not using GSD /pause | Lose progress between sessions | Always /pause before ending |
| Giving vague prompts | AI ignores the structured output schema | Reference the exact output_schema from agent file |
