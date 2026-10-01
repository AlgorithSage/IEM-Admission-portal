# Shared Memory — Project Instance

> This folder is the communication bus between all agents.
> Copy this entire `shared_memory/` folder into each new project.

## Folder Structure

```
shared_memory/
├── prd/              ← @PM writes here
├── architecture/     ← @ARCH writes here
├── design/           ← @DESIGN writes here
├── frontend/         ← @FE writes here
├── backend/          ← @BE writes here
├── security/         ← @SEC writes here
├── compliance/       ← @ETHICS writes here
├── tests/            ← @QA writes here
├── deployment/       ← @OPS writes here
└── logs/             ← @GUARD, @QA, @DATA write here
```

## Rules

1. **After every agent session** → save output to the correct subfolder
2. **Before starting an agent** → feed it the files from the subfolders it reads
3. **Never delete** — only append or create new versions
4. **Gate blocking** → if @SEC, @ETHICS, or @QA output has `approval_status: false`, stop the pipeline
