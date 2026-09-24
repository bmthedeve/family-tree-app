# Family Tree App Notes

## Current cloud architecture (September 2026)

- New nodes get collision-free positions near visible members; existing positions remain unchanged.
- Gender is shown with both shape and color. A deceased flag or death date adds a subtle 1px dashed border, without a symbol beside the name.
- Cmd/Ctrl + Backslash toggles the sidebar, including from form fields (except while a dialog is open). Search stays above the independently scrolling sidebar controls; the toolbar lens reveals/focuses it, or opens a popover in canvas-only mode.
- Person records support optional `notes`, `deceased`, and `descendantsCollapsed` fields in the existing JSON cloud document; no database migration is needed.
- Per-parent −/+ canvas buttons hide descendants via parent links, preserving nested collapse preferences. Search reveals hidden results; Expand All Generations clears all branch folds.

- Supabase email/password accounts can own multiple private named rows in `family_tree_documents`. The tree UUID is the primary key; `owner_id` remains the RLS ownership field.
- Apply `202609240001_named_family_trees.sql` after the initial migration to preserve existing documents as **My Family Tree** and enable the tree picker, creation, and renaming.
- Select/Pan canvas tools expose area selection without requiring Shift. Native Cytoscape group dragging moves selected members exactly once (the previous custom follower movement has been removed).
- Box selection requires fully enclosed visible icon bounds, excluding labels. A post-boxend correction handles Cytoscape 3.29.2's intersection selection while preserving prior additive selection; mouse selection works in both directions and at any zoom/pan.
- New accounts start empty; the former shared sample dataset is no longer loaded.
- Apply `supabase/migrations/202609230001_private_family_trees.sql` using the dashboard before cloud storage can work. See `supabase/SETUP.md` for redirect URLs and shared Auth considerations.
- Cloud saves include people, relationships, node positions, and recycle-bin entries. Revision checks prevent stale tabs overwriting newer cloud changes.
- A tab retains unsaved drafts per account and tree ID in sessionStorage. Existing legacy localStorage family data remains available for manual export/import and is never automatically uploaded.
- Undo history is session-only; sign-out clears forms, dialogs, graph, and history.
- The floating Undo toast respects `hidden` and only appears following deletion. Editing from the table opens the sidebar and focuses the name field.
- The historical localStorage/sample-data notes below describe the earlier version and are superseded by this section.

This file tracks the implemented features and major changes made to the family tree application so it can be reused in a new chat if needed.

## Project Overview

Static web app built with:

- `index.html`
- `style.css`
- `script.js`
- Cytoscape.js for graph rendering

The app models a family as a graph, not a strict tree.

## Data Model

Stored as:

```json
{
  "people": [],
  "relationships": []
}
```

Each person includes:

- `id`
- `name`
- `gender`
- `dateOfBirth`
- `dateOfDeath` optional

Each relationship includes:

- `from`
- `to`
- `type`

Supported relationship inputs:

- `parent`
- `child`
- `spouse`
- `sibling`

Internal storage rules:

- `parent` is stored only as `parent -> child`
- `child` is normalized into `parent -> child`
- `spouse` is stored both directions
- `sibling` is stored both directions

## Relationship Logic Implemented

- Prevents self-relationships
- Prevents duplicate relationships
- Prevents invalid ancestor loops
- Derives parents and children dynamically from stored parent edges
- Auto-normalizes `child` relationships into stored `parent` edges
- Auto-heals spouse and sibling reverse links during normalization

## Main UI Features Implemented

- Add person form
- Add relationship form
- Relationship options include `Parent`, `Child`, `Spouse`, `Sibling`
- Date of birth is optional
- Date of death is optional
- Canvas/Table toggle on the right side
- Members table with:
  - Name
  - Gender
  - DOB
  - DOD
  - Parents
  - Children
  - Siblings
  - Spouses
  - Actions

## Table Actions Implemented

- Edit icon opens the selected person in the Add Person form
- Delete icon deletes immediately without confirmation
- Deleting a person also deletes connected relationships

## Canvas Features Implemented

- Infinite canvas behavior with Cytoscape
- Mouse wheel zoom
- Background panning
- Manual node dragging
- Double-click background reset
- Center on selected node
- Tooltip on hover showing name, DOB, DOD
- LocalStorage persistence
- PNG export
- Editable family file export/import
- Re-run layout button
- Canvas-only new-tab view using `?view=canvas`

## Import / Export File Support

Implemented:

- Export current graph as an editable JSON file
- Import that file later and continue editing
- Saved node positions are preserved in the exported file

Current export filename:

- `family-graph.familygraph.json`

Purpose:

- similar to Excalidraw's editable file workflow
- lets the graph be restored with nodes, relationships, and positions intact

## Visual Rules Implemented

- Male nodes are blue
- Female nodes are pink
- Parent edges are green
- Spouse edges are red
- Sibling edges are purple
- Edge labels are shown
- Long node names shrink font size to stay inside the circle

## Sidebar and Layout Changes Implemented

- Left sidebar can be resized using a centered drag handle on its right edge
- Sidebar width persists using LocalStorage
- Main screen uses a full-height split layout
- Sidebar scrolls internally
- Canvas fills the available height better than before

## Canvas-Only View

Implemented via:

- opening a new tab with `?view=canvas`

Behavior:

- hides the left sidebar
- keeps the graph/canvas only
- keeps the top canvas header
- hides the canvas/table toggle and help text
- hides the expand button in canvas-only mode

## Selection and Multi-Drag

Implemented:

- `Shift + drag` on the canvas to area-select nodes
- selected nodes are visibly highlighted
- dragging one selected node moves the entire selected group together

## Highlighting Behavior

Clicking a person highlights:

- parents
- children
- siblings
- spouses

Also implemented:

- clearing highlight when returning to canvas view
- avoiding stale faded state when switching views

## Layout Behavior

- Initial layout uses automatic fit
- Re-run Layout forces a fresh automatic layout
- Saved manual positions are preserved otherwise
- Fit padding increased for canvas-only mode to reduce clipping near edges

## Files to Look At

- [index.html](/Users/balamurugan/Documents/family-tree-app/index.html)
- [style.css](/Users/balamurugan/Documents/family-tree-app/style.css)
- [script.js](/Users/balamurugan/Documents/family-tree-app/script.js)

## Suggested Reuse Prompt For A New Chat

If this chat runs out, use something like:

```text
Please read PROJECT_NOTES.md in the family-tree-app repo and continue from the current implementation state.
```

## Note

I can continue updating this file as we make more changes in this chat.

## Safety, Relationship Management, and Search

Implemented:

- Confirmation before deleting a person, including the number of affected relationships
- Recycle Bin with restore and permanent-delete actions
- Undo/redo history for person, relationship, import, and recycle-bin mutations
- Temporary notifications with a direct Undo action
- Keyboard shortcuts for undo and redo
- Canonical relationship manager that hides reverse-link duplication
- Relationship editing and deletion from the manager or by selecting a graph edge
- Per-person relationship management from the members table
- Current/former spouse status and relationship start/end dates
- Name search with jump-to, centering, and family-neighborhood highlighting
- Safer escaping of imported names in generated UI
