# Shared Memory Structure (Blackboard)

> **Communication bus between all 11 agents.**
> Every agent reads/writes structured JSON to this blackboard. No free-text passing.

---

## Schema

```json
{
  "shared_memory": {
    "project_id": "",
    "project_name": "",
    "created_at": "",
    "last_updated": "",

    "artifacts": {

      "project_context": {
        "status": "TEMPORARY | FINALIZED | OMNIPRESENT",
        "owner": "@PM",
        "context_doc_path": "shared_memory/final_project_context.md",
        "user_approved_updates": true,
        "version": 1
      },

      "prd": {
        "status": "DRAFT | FINALIZED | REVISION_REQUIRED",
        "owner": "@PM",
        "feature_name": "",
        "user_stories": [
          {
            "id": "US-001",
            "as_a": "",
            "i_want": "",
            "so_that": "",
            "acceptance_criteria": [],
            "priority": "P0 | P1 | P2 | P3"
          }
        ],
        "task_flow": [],
        "constraints": [],
        "non_functional_requirements": [],
        "version": 1
      },

      "architecture": {
        "status": "DRAFT | APPROVED | REVISION_REQUIRED",
        "owner": "@ARCH",
        "system_type": "",
        "architecture_diagram": "",
        "microservices": [
          {
            "name": "",
            "responsibility": "",
            "tech_stack": "",
            "port": ""
          }
        ],
        "api_contracts": [
          {
            "method": "GET | POST | PUT | DELETE | PATCH",
            "path": "",
            "request_body": {},
            "response_body": {},
            "auth_required": true,
            "rate_limited": true
          }
        ],
        "db_schema": {
          "engine": "",
          "tables": [
            {
              "name": "",
              "columns": [],
              "indexes": [],
              "relations": []
            }
          ]
        },
        "failure_points": [],
        "scaling_plan": "",
        "version": 1
      },

      "design": {
        "status": "DRAFT | APPROVED | REVISION_REQUIRED",
        "owner": "@DESIGN",
        "design_system": {
          "colors": {
            "primary": "",
            "secondary": "",
            "accent": "",
            "background": "",
            "surface": "",
            "error": "",
            "success": "",
            "warning": ""
          },
          "typography": {
            "font_family": "",
            "heading_sizes": {},
            "body_sizes": {}
          },
          "spacing": {
            "unit": "",
            "scale": []
          },
          "border_radius": {}
        },
        "components": [
          {
            "component_name": "",
            "states": ["default", "hover", "active", "disabled", "loading", "error", "empty"],
            "props": [],
            "accessibility": [],
            "ag_ui_role": "static | event_consumer | tool_handler | hitl_control | generative_renderer | activity_display",
            "interaction_triggers": [
              {
                "event": "click | drag | submit | etc",
                "action": "approveWorkflowStep | updateKanbanBoard | etc",
                "payload_schema": {}
              }
            ],
            "responsive_behavior": ""
          }
        ],
        "user_flows": [
          {
            "flow_name": "",
            "steps": [],
            "entry_point": "",
            "exit_point": ""
          }
        ],
        "version": 1
      },

      "frontend": {
        "status": "IN_PROGRESS | COMPLETE | REVISION_REQUIRED",
        "owner": "@FE",
        "framework": "",
        "components": [
          {
            "name": "",
            "code_path": "",
            "dependencies": [],
            "ag_ui_role": "static | event_consumer | tool_handler | hitl_control | generative_renderer | activity_display",
            "test_status": "PASS | FAIL | UNTESTED"
          }
        ],
        "routes": [],
        "state_management": "",
        "performance_notes": "",
        "accessibility_status": "",
        "ag_ui_integration": {
          "tools_defined": [],
          "events_handled": [],
          "state_sync_method": "snapshot_only | snapshot_and_delta | none",
          "hitl_patterns": []
        },
        "version": 1
      },

      "backend": {
        "status": "IN_PROGRESS | COMPLETE | REVISION_REQUIRED",
        "owner": "@BE",
        "framework": "",
        "modules": [
          {
            "module_name": "",
            "routes": [],
            "controllers": "",
            "models": "",
            "middlewares": []
          }
        ],
        "security_measures": [],
        "database_migrations": [],
        "version": 1
      },

      "security": {
        "status": "PENDING | AUDITED | BLOCKED",
        "owner": "@SEC",
        "audit_target": "",
        "vulnerabilities": [
          {
            "severity": "CRITICAL | HIGH | MEDIUM | LOW",
            "type": "",
            "description": "",
            "exploit_scenario": "",
            "fix": "",
            "fixed": false
          }
        ],
        "approval_status": false,
        "version": 1
      },

      "compliance": {
        "status": "PENDING | AUDITED | BLOCKED",
        "owner": "@ETHICS",
        "feature": "",
        "violations": [
          {
            "issue": "",
            "law": "",
            "fix": "",
            "fixed": false
          }
        ],
        "bias_analysis": "",
        "approval_status": false,
        "version": 1
      },

      "tests": {
        "status": "PENDING | RUNNING | PASS | FAIL | PARTIAL",
        "owner": "@QA",
        "feature": "",
        "overall_status": "PASS | FAIL | PARTIAL",
        "test_cases": [
          {
            "id": "TC-001",
            "description": "",
            "type": "unit | integration | e2e | edge_case",
            "result": "PASS | FAIL | SKIP",
            "error": ""
          }
        ],
        "coverage_percent": 0,
        "bugs": [],
        "recommendation": "DEPLOY | HOLD | FIX_REQUIRED",
        "version": 1
      },

      "deployment": {
        "status": "PENDING | DEPLOYED | ROLLBACK",
        "owner": "@OPS",
        "environment": "",
        "deployment_steps": [],
        "ci_cd_pipeline": "",
        "monitoring": [],
        "rollback_strategy": "",
        "deployed_url": "",
        "version": 1
      },

      "incident_reports": {
        "status": "OPEN | RESOLVED | MITIGATED",
        "owner": "@DEBUGGER",
        "incidents": [
          {
            "id": "INC-001",
            "severity": "P0 | P1 | P2",
            "root_cause": "",
            "code_fix": [],
            "prevention_strategy": ""
          }
        ],
        "version": 1
      }
    },

    "logs": [
      {
        "timestamp": "",
        "agent": "",
        "action": "",
        "result": "SUCCESS | FAIL | BLOCKED",
        "details": ""
      }
    ],

    "state": {
      "current_phase": "",
      "current_agent": "",
      "iteration_count": 0,
      "max_iterations": 3,
      "status": "IN_PROGRESS | BLOCKED | PASSED | FAILED",
      "pipeline_position": 0,
      "pipeline_order": [
        "@PM", "@GUARD", "@ARCH", "@DESIGN",
        "@FE", "@BE", "@SEC", "@ETHICS",
        "@QA", "@OPS", "@DATA"
      ],
      "gate_results": {
        "guard": null,
        "security": null,
        "ethics": null,
        "qa": null
      }
    },

    "agents": {
      "@PM":     { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@GUARD":  { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@ARCH":   { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@DESIGN": { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@FE":     { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@BE":     { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@SEC":    { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@ETHICS": { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@QA":     { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@OPS":    { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@DATA":   { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@DEBUGGER": { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" },
      "@REPAIR": { "status": "IDLE | ACTIVE | DONE | BLOCKED", "last_run": "" }
    }
  }
}
```

---

## Read/Write Permissions

| Agent | Reads From | Writes To |
| ------- | ---------- | --------- |
| `@PM` | user_input, all_agent_outputs | `prd`, `state`, `project_context` |
| `@GUARD` | `prd`, `architecture`, `design` | `logs` |
| `@ARCH` | `prd` | `architecture` |
| `@DESIGN` | `prd` | `design` |
| `@FE` | `design`, `architecture` | `frontend` |
| `@BE` | `architecture` | `backend` |
| `@SEC` | `architecture`, `backend`, `frontend` | `security` |
| `@ETHICS` | `prd`, `architecture`, `backend` | `compliance` |
| `@QA` | `frontend`, `backend`, `prd` | `tests`, `logs` |
| `@OPS` | `tests`, `backend`, `frontend` | `deployment` |
| `@DATA` | `deployment` | `logs` |
| `@DEBUGGER` | `logs`, `frontend`, `backend`, `tests`, `architecture` | `incident_reports` |
| `@REPAIR` | `logs`, `frontend`, `backend`, `tests`, `architecture` | `incident_reports`, `logs` |

---

## Governance Rules

1. **No free-text** — All inter-agent communication uses this schema
2. **Version tracking** — Every artifact increments `version` on update
3. **Gate blocking** — If `approval_status = false` on security/compliance/tests, pipeline halts
4. **Max 3 iterations** — Agent retries capped at `state.max_iterations`
5. **Immutable logs** — `logs[]` is append-only, never edited
6. **Status propagation** — When a gate blocks, `state.status` becomes `BLOCKED`