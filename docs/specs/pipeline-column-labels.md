# Spec: Workspace pipeline column titles

## Objective

Each workspace can name its five pipeline columns independently while the existing status values remain stable for ideas, filters, metrics, and imports. Workspace members with edit access can rename a column inline from the Kanban header.

## Success criteria

- Every existing workspace receives one title row per pipeline status through an idempotent SQL backfill.
- Workspace owners/editors can archive an unused column; the API rejects archiving while ideas remain in that status.
- The API reads and updates titles within the selected workspace and enforces workspace membership and editor permissions.
- Kanban headers, status filters, dropdowns, table labels, and the idea drawer use the workspace title when available.
- If the settings endpoint is unavailable, the UI falls back to the current built-in labels without blocking the pipeline.
- Empty or overlong titles are rejected; failed updates show a visible error and do not replace the saved title.

## Data model

`workspace_pipeline_columns` is keyed by `(workspace_id, status)`. `status` keeps the existing Vietnamese status values as stable internal keys; `title` is the workspace-facing label.

## Verification

- Frontend: `cd frontend && npm test`, `npm run build`.
- Backend: `python -m unittest discover -s backend/tests`.
- SQL: migration is idempotent and includes a separate backfill statement for existing workspaces.
