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
- Open on-demand search from the magnifying glass beside Select/Pan; no sidebar space is reserved for search
- Record, edit, and delete parent, child, spouse, and sibling relationships
- Track current/former spouse status and relationship start/end dates
- Prevent duplicate, self-referential, and circular ancestor relationships
- Explore relationships on an interactive, zoomable Cytoscape.js canvas
- Drag a selection rectangle in **Select** mode, then move all selected people together; use **Pan** to move the canvas
- Align selected members or give them equal horizontal/vertical spacing, with Undo/Redo
- Use zoom buttons, a live zoom percentage, and Fit Tree without rearranging member positions
- Quick-add a selected member's parent, child, or spouse with the relationship created automatically
- Highlight a person's immediate family by selecting their node
- Switch between graph and table views
- Collapse the sidebar for a full-width canvas and restore it when needed
- Enter fullscreen to hide all app controls and show only the canvas; press Esc to return
- Export the graph as a PNG image
- Export the selected tree and import an editable `.familygraph.json` file as a separate named tree without replacing existing trees
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

The account bar contains a **Family tree** picker, **New Tree**, **Rename**, **Export Tree**, and **Import Tree**. Existing trees are preserved as **My Family Tree** after applying the [named-tree migration](supabase/migrations/202609240001_named_family_trees.sql). Each tree has its own people, relationships, recycle bin, recovery draft, and save revision. Switching waits for pending saves and clears the previous tree's undo history.

Choose a tree and click **Export Tree** to download its `.familygraph.json` file, including its name, people, metadata, relationships, positions, and collapsed-generation settings (not its recycle bin). **Import Tree** accepts these files and legacy JSON files containing `people` and `relationships`. Confirm or change the name in the import dialog to create a separate private tree; existing trees are never replaced. Invalid files are rejected before creating a tree. GEDCOM and files from other genealogy tools are not currently supported.

**Select** is the default canvas tool: drag on empty canvas to box-select members, then drag any selected member to move the group while keeping its arrangement. An icon must be completely enclosed by the rectangle; partial overlaps and labels do not count. Use **Pan** to drag the background instead. <kbd>Shift</kbd> + drag selects a group in either mode. Only visible members can be selected. Member positions are saved when you release the group.

In **Pan** mode, click a member to open the sidebar directly in edit mode. Dragging a member still moves it without opening the form. The **Fullscreen** button hides the account bar, sidebar, and canvas toolbar. Press <kbd>Esc</kbd> to restore the previous view, or click a member in Pan mode to leave fullscreen and edit. When native browser fullscreen is unavailable, the same distraction-free layout fills the browser viewport. The separate canvas-tab button remains available as well.

The canvas control strip provides **− / +** zoom buttons, the current zoom percentage (click it for 100%), and **Fit Tree** to frame all visible members without changing their positions. Generation −/+ buttons scale with the diagram, including at low zoom levels.

Select at least two members and open **Arrange** for left/right/top/bottom alignment or horizontal/vertical centering. Select three or more for equal edge-to-edge spacing. Spacing keeps at least 24 diagram units between icons; crowded selections expand to make room. Only selected visible members move, positions save to the active tree, and each arrangement can be undone in one step.

Select one member to reveal **+ Parent**, **+ Child**, and **+ Spouse** beside their name in the canvas controls. These actions also appear above the sidebar editor when editing a person. Fill in the new relative's details and save to create both the member and their relationship as one undoable change. Cancel makes no changes. Parents start above, children below, and spouses beside the chosen member where space allows; occupied positions are avoided. Hidden ancestor branches open so the new relative can be seen. Spouses start with current status; edit the relationship to add dates or change status.

1. Add people from the sidebar.
2. Click the magnifying glass beside Select/Pan to open **Find Person**, even with the sidebar closed. Choose a result to center and highlight that person. The popover closes after choosing a result, clicking outside, or pressing Esc.
3. Choose two people and define their relationship. Person A, Person B, and relationship details remain selected after adding the relationship. Spouse relationships can include status and dates.
4. Select a graph edge or use **Manage Relationships** to edit or delete a connection.
5. Drag nodes to organize the graph, scroll to zoom, or drag the background to pan.
6. Use the sidebar button or <kbd>Cmd/Ctrl</kbd> + <kbd>\\</kbd> to toggle between editing controls and a full-width canvas. The shortcut also works while typing in a form, but not while a dialog is open.
7. Use **Re-run Layout** to automatically arrange the family network.
8. Use **Export Tree** to create an editable backup that can later be restored as a new tree with **Import Tree**.

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
├── canvas-layout.js  # Pure selected-member alignment and spacing calculations
├── cloud-store.js    # Account-scoped cloud persistence and write conflicts
├── supabase-config.js # Public project URL and publishable key
├── supabase/         # Database migration and setup instructions
├── tests/            # Layout/cloud-store unit tests and mocked browser smoke test
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
