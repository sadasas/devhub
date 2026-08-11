-- Store each project's PRD (purpose, goals, features, scope, out of scope)
-- as a jsonb column separate from the `data` state payload so the PRD can be
-- edited without touching the state schema, MCP tools, or export format.
ALTER TABLE projects ADD COLUMN prd jsonb NOT NULL DEFAULT '{}';
