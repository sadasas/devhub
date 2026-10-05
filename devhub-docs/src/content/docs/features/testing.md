---
title: Test cases
description: Checklist test cases attached to tasks and issues — Pass, Fail, or Pending.
---

Done means tested. Test-case checklists attach to tasks and issues, each with steps, an expected result, and a status: Pass, Fail, or Pending.

## What you get

- Checklists per task or issue — steps to verify plus the expected result.
- Status at a glance across the project, so "done" always means "tested".

## Working with agents

MCP tools: `add_test_case` / `update_test_case` (name, taskId / issueId, steps, expected, status). Write the test case when the task or issue is created, flip it to pass when the fix lands. See [MCP Integration](/mcp/).

Part of [Features](/features/). Related: [Tasks](/features/tasks/) and [Issues](/features/issues/) that test cases verify, [Milestones](/features/milestones/) that ship them.
