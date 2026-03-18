# Family Tree App Notes

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
