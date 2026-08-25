# Family Graph

A lightweight, browser-based family relationship explorer. Build and edit a family network, view it as an interactive graph or table, and save it locally or export it for later use.

## Live app

Use the app on GitHub Pages: [bmthedeve.github.io/family-tree-app](https://bmthedeve.github.io/family-tree-app/)

## Features

- Add, edit, and delete family members
- Record parent, child, spouse, and sibling relationships
- Prevent duplicate, self-referential, and circular ancestor relationships
- Explore relationships on an interactive, zoomable Cytoscape.js canvas
- Select multiple people with <kbd>Shift</kbd> + drag and move them together
- Highlight a person's immediate family by selecting their node
- Switch between graph and table views
- Collapse the sidebar for a full-width canvas and restore it when needed
- Export the graph as a PNG image
- Export and import an editable `.familygraph.json` file
- Preserve family data, node positions, sidebar width, and sidebar visibility in browser storage
- Open a distraction-free canvas in a separate tab

## Run locally

No build or package installation is required. Clone the repository and serve the directory with any static HTTP server:

```bash
git clone git@github.com:bmthedeve/family-tree-app.git
cd family-tree-app
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser.

The Cytoscape.js library and Manrope font are loaded from public CDNs, so an internet connection is needed when the app first loads those assets.

## Using the app

1. Add people from the sidebar.
2. Choose two people and define their relationship.
3. Drag nodes to organize the graph, scroll to zoom, or drag the background to pan.
4. Use the sidebar button in the canvas header to toggle between editing controls and a full-width canvas.
5. Use **Re-run Layout** to automatically arrange the family network.
6. Use **Export Family File** to create an editable backup that can later be restored with **Import Family File**.

Family data is automatically saved to the browser's `localStorage`. Clearing site data will remove that saved copy, so export a family file for a portable backup.

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
└── PROJECT_NOTES.md  # Implementation notes and feature history
```

## Technology

- HTML5
- CSS3
- Vanilla JavaScript
- [Cytoscape.js](https://js.cytoscape.org/)

## License

No license has been specified for this project.
