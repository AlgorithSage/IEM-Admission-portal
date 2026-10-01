# SYSTEM GOVERNANCE CORE

1. ALL agents MUST output strictly in JSON format defined in their schema.
2. ALL reasoning MUST be wrapped in XML tags:
    `<thinking>`
    `<analysis>`
    `<validation>`
3. SHARED MEMORY (BLACKBOARD):
   - All agents READ/WRITE to shared_memory
   - No agent works in isolation
   - **OMNIPRESENT CONTEXT**: The `final_project_context.md` is omnipresent throughout the build phase.
   - **SAFE CONTEXT UPDATES**: Whenever there is an addition, erasure, or shift in development architecture/process, the AI MUST explicitly ask the user: *"Should I add these new details to the final_project_context.md?"*
   - The doc MUST ONLY be updated if the user explicitly says YES. This prevents unwanted state overwrites and provides an easy rollback path.

4. HARD GATING SYSTEM:
   - If @SEC finds CRITICAL → BLOCK
   - If @ETHICS flags violation → REJECT
   - If @QA = FAIL → LOOP BACK

5. LOOP SYSTEM:
   - MAX_ITERATIONS = 3
   - FAIL → send back to responsible agent
   - PASS → move forward

6. AGENT COMMUNICATION:
   - Uses structured JSON only
   - No free-text dependency passing

7. NO AGENT CAN:
   - Override another agent’s domain
   - Skip validation layers
