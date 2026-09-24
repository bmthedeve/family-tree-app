# Family Graph

A browser-based family relationship explorer with email/password sign-in and multiple private, named, cloud-saved family trees per user. Build and edit family networks, view them as graphs or tables, and export them for backup.

## Live app

Use the app on GitHub Pages: [bmthedeve.github.io/family-tree-app](https://bmthedeve.github.io/family-tree-app/)

## Features

- Supabase email/password sign-in and account creation
- Create, rename, and switch between any number of private trees, subject to your Supabase storage quota
- Empty starting canvas and private cloud storage for each account
- Save status, retry, draft recovery, and protection against stale-tab overwrites
- Add, edit, and delete family members
- Place new members in free space beside existing members without overlapping them
- Distinguish male members with blue rounded squares and female members with pink circles
- Mark deceased members with a subtle, thin dashed outline, even when their death date is unknown
- Keep editable notes/metadata for each member
- Collapse or expand a parent's descendants using its −/+ button; expand every branch from the sidebar
- Search for a person by name and jump directly to their highlighted graph node
- Record, edit, and delete parent, child, spouse, and sibling relationships
- Track current/former spouse status and relationship start/end dates
- Prevent duplicate, self-referential, and circular ancestor relationships
- Explore relationships on an interactive, zoomable Cytoscape.js canvas
- Drag a selection rectangle in **Select** mode, then move all selected people together; use **Pan** to move the canvas
- Highlight a person's immediate family by selecting their node
- Switch between graph and table views
- Collapse the sidebar for a full-width canvas and restore it when needed
- Export the graph as a PNG image
- Export and import an editable `.familygraph.json` file
- Save family data, node positions, and recycle bin to Supabase; remember sidebar preferences in the browser
- Undo and redo up to 50 data changes with keyboard shortcuts
- Review relationship impact before deleting a person
- Restore deleted people and their surviving connections from the Recycle Bin
- Open a distraction-free canvas in a separate tab

## Run locally

First complete the [one-time Supabase setup](supabase/SETUP.md), including the database migration and email redirect allowlist. The public project URL/key are in `supabase-config.js`; no secret keys belong in this app.

No build or package installation is required. Clone the repository and serve the directory with any static HTTP server:

```bash
git clone git@github.com:bmthedeve/family-tree-app.git
cd family-tree-app
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser.

The Supabase client, Cytoscape.js library, and Manrope font load from public CDNs. An internet connection is needed to sign in, load cloud data, and save changes.

## Using the app

The account bar contains a **Family tree** picker, **New Tree**, and **Rename**. Existing trees are preserved as **My Family Tree** after applying the [named-tree migration](supabase/migrations/202609240001_named_family_trees.sql). Each tree has its own people, relationships, recycle bin, recovery draft, and save revision. Switching waits for pending saves and clears the previous tree's undo history. Family-file exports use the tree's name; imports replace only the currently selected tree.

**Select** is the default canvas tool: drag on empty canvas to box-select members, then drag any selected member to move the group while keeping its arrangement. An icon must be completely enclosed by the rectangle; partial overlaps and labels do not count. Use **Pan** to drag the background instead. <kbd>Shift</kbd> + drag selects a group in either mode. Only visible members can be selected. Member positions are saved when you release the group.

1. Add people from the sidebar.
2. **Find Person** stays pinned at the top of the sidebar while its other controls scroll. The magnifying-glass button beside Select/Pan opens and focuses search, even with the sidebar closed; it opens a search popover in the separate canvas-only tab. Choose a result to center and highlight that person.
3. Choose two people and define their relationship. Spouse relationships can include status and dates.
4. Select a graph edge or use **Manage Relationships** to edit or delete a connection.
5. Drag nodes to organize the graph, scroll to zoom, or drag the background to pan.
6. Use the sidebar button or <kbd>Cmd/Ctrl</kbd> + <kbd>\\</kbd> to toggle between editing controls and a full-width canvas. The shortcut also works while typing in a form, but not while a dialog is open.
7. Use **Re-run Layout** to automatically arrange the family network.
8. Use **Export Family File** to create an editable backup that can later be restored with **Import Family File**.

Use the on-screen controls or <kbd>Ctrl/Cmd</kbd> + <kbd>Z</kbd> to undo and <kbd>Ctrl/Cmd</kbd> + <kbd>Y</kbd> (or <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>) to redo. Deleted people remain available in the Recycle Bin until they are permanently removed.

Use the pencil icon to edit a person's notes or deceased status. A death date also marks a person as deceased. Hover over a member to read their notes. Generation controls hide all descendants reachable through parent links, including shared descendants; no people or relationships are deleted. Nested collapsed branches remain collapsed when their ancestor is expanded. Search automatically opens branches hiding its result. Notes and branch preferences are saved with your tree and included in family-file exports.

Sign in before editing. Each account begins with an empty canvas and can only load its own family tree. Wait for **Saved to cloud** before closing. Unsaved drafts survive reloads in the same tab; export a family file for a portable backup. Older browser-only data is not uploaded automatically: download it from the sign-in screen, then import it into the intended account.

## Relationship model

The app stores data as a graph:

```json
{
  "people": [],
  "relationships": []
}
```

Parent relationships are stored as `parent -> child`. A relationship entered as `child` is normalized to that format. Spouse and sibling relationships are stored in both directions. Removing a person also removes every relationship connected to them.

## Project structure

```text
.
├── index.html        # Application markup
├── style.css         # Layout and visual styling
├── script.js         # State, graph rendering, and interactions
├── cloud-store.js    # Account-scoped cloud persistence and write conflicts
├── supabase-config.js # Public project URL and publishable key
├── supabase/         # Database migration and setup instructions
├── tests/            # Cloud-store unit tests and mocked browser smoke test
└── PROJECT_NOTES.md  # Implementation notes and feature history
```

## Technology

- HTML5
- CSS3
- Vanilla JavaScript
- [Cytoscape.js](https://js.cytoscape.org/)
- Supabase Auth and Postgres with Row Level Security

## License

No license has been specified for this project.
