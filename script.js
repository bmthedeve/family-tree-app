const STORAGE_KEY = "family-tree-app-data-v1";
const SIDEBAR_WIDTH_KEY = "family-tree-sidebar-width-v1";
const SIDEBAR_COLLAPSED_KEY = "family-tree-sidebar-collapsed-v1";
const HISTORY_LIMIT = 50;

// Never load the old shared browser tree into a signed-in account automatically.
const state = { people: [], relationships: [] };
const isCanvasOnlyMode = new URLSearchParams(window.location.search).get("view") === "canvas";

const refs = {
  personForm: document.getElementById("person-form"),
  relationshipForm: document.getElementById("relationship-form"),
  personA: document.getElementById("person-a"),
  personB: document.getElementById("person-b"),
  relationshipType: document.getElementById("relationship-type"),
  relationshipStatus: document.getElementById("relationship-status"),
  relationshipStartDate: document.getElementById("relationship-start-date"),
  relationshipEndDate: document.getElementById("relationship-end-date"),
  newSpouseDetails: document.getElementById("new-spouse-details"),
  personSearch: document.getElementById("person-search"),
  searchResults: document.getElementById("search-results"),
  searchPanel: document.getElementById("person-search-panel"),
  findPersonButton: document.getElementById("find-person-button"),
  message: document.getElementById("message"),
  stats: document.getElementById("stats"),
  tooltip: document.getElementById("tooltip"),
  layoutButton: document.getElementById("layout-button"),
  resetViewButton: document.getElementById("reset-view-button"),
  exportButton: document.getElementById("export-button"),
  exportDataButton: document.getElementById("export-data-button"),
  importDataButton: document.getElementById("import-data-button"),
  importDataInput: document.getElementById("import-data-input"),
  expandCanvasButton: document.getElementById("expand-canvas-button"),
  sidebarToggleButton: document.getElementById("sidebar-toggle-button"),
  sidebar: document.getElementById("sidebar"),
  resizeHandle: document.getElementById("sidebar-resize-handle"),
  canvasTab: document.getElementById("canvas-tab"),
  tableTab: document.getElementById("table-tab"),
  canvasView: document.getElementById("canvas-view"),
  tableView: document.getElementById("table-view"),
  peopleTableBody: document.getElementById("people-table-body"),
  personSubmit: document.getElementById("person-submit"),
  personCancel: document.getElementById("person-cancel"),
  undoButton: document.getElementById("undo-button"),
  redoButton: document.getElementById("redo-button"),
  manageRelationshipsButton: document.getElementById("manage-relationships-button"),
  recycleBinButton: document.getElementById("recycle-bin-button"),
  recycleCount: document.getElementById("recycle-count"),
  deletePersonDialog: document.getElementById("delete-person-dialog"),
  deletePersonTitle: document.getElementById("delete-person-title"),
  deletePersonCopy: document.getElementById("delete-person-copy"),
  confirmDeletePerson: document.getElementById("confirm-delete-person"),
  relationshipsDialog: document.getElementById("relationships-dialog"),
  relationshipsDialogTitle: document.getElementById("relationships-dialog-title"),
  relationshipsList: document.getElementById("relationships-list"),
  closeRelationshipsDialog: document.getElementById("close-relationships-dialog"),
  relationshipEditorDialog: document.getElementById("relationship-editor-dialog"),
  relationshipEditorForm: document.getElementById("relationship-editor-form"),
  editRelationshipKey: document.getElementById("edit-relationship-key"),
  editPersonA: document.getElementById("edit-person-a"),
  editPersonB: document.getElementById("edit-person-b"),
  editRelationshipType: document.getElementById("edit-relationship-type"),
  editRelationshipStatus: document.getElementById("edit-relationship-status"),
  editRelationshipStartDate: document.getElementById("edit-relationship-start-date"),
  editRelationshipEndDate: document.getElementById("edit-relationship-end-date"),
  editSpouseDetails: document.getElementById("edit-spouse-details"),
  cancelRelationshipEdit: document.getElementById("cancel-relationship-edit"),
  deleteRelationshipDialog: document.getElementById("delete-relationship-dialog"),
  deleteRelationshipCopy: document.getElementById("delete-relationship-copy"),
  confirmDeleteRelationship: document.getElementById("confirm-delete-relationship"),
  recycleBinDialog: document.getElementById("recycle-bin-dialog"),
  recycleBinList: document.getElementById("recycle-bin-list"),
  closeRecycleBin: document.getElementById("close-recycle-bin"),
  undoToast: document.getElementById("undo-toast"),
  undoToastMessage: document.getElementById("undo-toast-message"),
  toastUndoButton: document.getElementById("toast-undo-button")
};

let cy;
let backgroundTapTimer = null;
let editingPersonId = null;
let recycleBin = [];
let undoStack = [];
let redoStack = [];
let pendingDeletePersonId = null;
let pendingDeleteRelationshipKey = null;
let relationshipFilterPersonId = null;
let toastTimer = null;
let cloudStore = null;
let cloudApplying = true;
let authClient = null;
let activeUserId = null;
let sessionGeneration = 0;
let activeTreeId = null;
let treeCatalog = null;
let treeList = [];
let treeDialogMode = "create";
let treeChanging = false;
let pendingImport = null;
let fullscreenView = null;
let nativeFullscreenEntered = false;

initialize();
startCloudAuth();

function initialize() {
  applyMode();
  restoreSidebarWidth();
  restoreSidebarState();
  normalizeState();
  setupCy();
  populatePersonSelects();
  refreshStats();
  renderPeopleTable();
  renderSearchResults("");
  updateHistoryControls();
  updateRecycleBinCount();
  attachEvents();
  if (isCanvasOnlyMode) {
    setActiveView("canvas");
  }
  runLayout(true);
}

function normalizeState() {
  validateFamilyData(state);
  const peopleById = new Map();
  state.people = state.people.filter((person) => {
    if (!person?.id || peopleById.has(person.id)) {
      return false;
    }
    peopleById.set(person.id, person);
    return true;
  });

  const uniqueKeys = new Set();
  const normalizedRelationships = [];

  state.relationships.forEach((relationship) => {
    const { from, to, type } = relationship || {};
    if (!peopleById.has(from) || !peopleById.has(to) || from === to) {
      return;
    }

    if (!["parent", "child", "spouse", "sibling"].includes(type)) {
      return;
    }

    const normalizedType = type === "child" ? "parent" : type;
    const normalizedFrom = type === "child" ? to : from;
    const normalizedTo = type === "child" ? from : to;

    if (
      normalizedType === "parent" &&
      createsAncestorLoop(normalizedFrom, normalizedTo, normalizedRelationships)
    ) {
      return;
    }

    const metadata = normalizedType === "spouse" ? {
      status: relationship.status === "former" ? "former" : "current",
      startDate: validDateValue(relationship.startDate),
      endDate: validDateValue(relationship.endDate)
    } : {};

    addNormalizedRelationship(
      { from: normalizedFrom, to: normalizedTo, type: normalizedType, ...metadata },
      normalizedRelationships,
      uniqueKeys
    );

    if (normalizedType === "spouse" || normalizedType === "sibling") {
      addNormalizedRelationship(
        { from: normalizedTo, to: normalizedFrom, type: normalizedType, ...metadata },
        normalizedRelationships,
        uniqueKeys
      );
    }
  });

  state.relationships = normalizedRelationships;
  saveState();
}

function addNormalizedRelationship(relationship, normalizedRelationships, uniqueKeys) {
  const key = `${relationship.type}:${relationship.from}:${relationship.to}`;
  if (uniqueKeys.has(key)) {
    return;
  }

  uniqueKeys.add(key);
  normalizedRelationships.push(relationship);
}

function setupCy() {
  cy = cytoscape({
    container: document.getElementById("cy"),
    elements: buildElements(),
    style: getStyles(),
    layout: { name: "preset" },
    wheelSensitivity: 0.18,
    zoomingEnabled: true,
    userZoomingEnabled: true,
    panningEnabled: true,
    userPanningEnabled: false,
    boxSelectionEnabled: true,
    selectionType: "additive",
    autoungrabify: false,
    minZoom: 0.2,
    maxZoom: 3
  });
}

function getStyles() {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        color: "#ffffff",
        "text-wrap": "wrap",
        "text-max-width": 84,
        "text-valign": "center",
        "text-halign": "center",
        "font-size": "data(fontSize)",
        "font-weight": 700,
        width: 58,
        height: 58,
        shape: "data(shape)",
        "background-color": "data(color)",
        "border-width": 2,
        "border-color": "#ffffff",
        "overlay-padding": 8,
        "overlay-opacity": 0
      }
    },
    { selector: "node[deceased = 1]", style: { "border-style": "dashed", "border-width": 1, "border-color": "#746c60" } },
    {
      selector: "edge",
      style: {
        label: "data(label)",
        "font-size": 9,
        color: "#3a2f1d",
        "text-background-color": "rgba(255,255,255,0.9)",
        "text-background-opacity": 1,
        "text-background-padding": 3,
        "curve-style": "bezier",
        width: 3,
        "line-color": "data(color)",
        "target-arrow-color": "data(color)",
        "target-arrow-shape": "data(arrowShape)",
        "arrow-scale": 0.85
      }
    },
    {
      selector: "node:selected",
      style: {
        "border-width": 5,
        "border-color": "#f2c857"
      }
    },
    {
      selector: ".faded",
      style: {
        opacity: 0.15
      }
    },
    {
      selector: ".highlighted",
      style: {
        opacity: 1,
        "border-width": 4,
        "border-color": "#ffdb6e",
        width: 70,
        height: 70,
        "z-index": 999
      }
    },
    {
      selector: "edge.highlighted",
      style: {
        opacity: 1,
        width: 6,
        "z-index": 999
      }
    },
    { selector: ".generation-hidden", style: { display: "none" } }
  ];
}

function buildElements() {
  const nodes = state.people.map((person) => ({
    position: person.position,
    data: {
      id: person.id,
      ...personNodeData(person),
      color: person.gender === "male" ? "#4a86e8" : "#e878b6",
      fontSize: computeNodeFontSize(person.name),
      gender: person.gender,
      dateOfBirth: person.dateOfBirth,
      dateOfDeath: person.dateOfDeath || ""
    }
  }));

  const edges = state.relationships.map((relationship) => ({
    data: edgeData(relationship)
  }));

  return [...nodes, ...edges];
}

function edgeData(relationship) {
  return {
    id: `${relationship.type}:${relationship.from}:${relationship.to}`,
    source: relationship.from,
    target: relationship.to,
    relationshipType: relationship.type,
    relationshipKey: relationshipGroupKey(relationship),
    label: relationship.type === "spouse" && relationship.status === "former" ? "former spouse" : relationship.type,
    status: relationship.status || "",
    startDate: relationship.startDate || "",
    endDate: relationship.endDate || "",
    color: relationshipColor(relationship.type),
    arrowShape: relationship.type === "parent" ? "triangle" : "none"
  };
}

function personNodeData(person) {
  const deceased = !!(person.deceased || person.dateOfDeath);
  return {
    label: person.name,
    shape: person.gender === "male" ? "round-rectangle" : "ellipse",
    deceased: deceased ? 1 : 0
  };
}

function nextPersonPosition() {
  const nodes = cy.nodes();
  const visible = nodes.filter(node => node.visible());
  const anchor = visible.length ? visible[visible.length - 1].position() : { x: 0, y: 0 };
  if (!nodes.length) return { ...anchor };
  // Search nearby grid cells without moving any existing member.
  for (let radius = 1; radius <= nodes.length + 1; radius++) {
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== radius) continue;
        const candidate = { x: anchor.x + x * 110, y: anchor.y + y * 110 };
        if (nodes.every(node => Math.hypot(node.position().x - candidate.x, node.position().y - candidate.y) >= 100)) {
          return candidate;
        }
      }
    }
  }
}

function descendantsOf(personId) {
  const descendants = new Set();
  const pending = [...getChildren(personId)];
  while (pending.length) {
    const id = pending.pop();
    if (id === personId || descendants.has(id)) continue;
    descendants.add(id);
    pending.push(...getChildren(id));
  }
  return descendants;
}

function applyGenerationVisibility() {
  const hidden = new Set();
  state.people.filter(person => person.descendantsCollapsed).forEach(person => {
    descendantsOf(person.id).forEach(id => hidden.add(id));
  });
  cy.batch(() => {
    cy.nodes().forEach(node => node.toggleClass("generation-hidden", hidden.has(node.id())));
    cy.edges().forEach(edge => edge.toggleClass("generation-hidden", hidden.has(edge.source().id()) || hidden.has(edge.target().id())));
    cy.nodes(".generation-hidden").unselect();
  });
  renderGenerationControls();
}

function renderGenerationControls() {
  const controls = document.getElementById("generation-controls");
  const existing = new Map([...controls.children].map(button => [button.dataset.parentId, button]));
  const retained = new Set();
  state.people.forEach(person => {
    const node = cy.getElementById(person.id);
    if (!node.nonempty() || !node.visible() || !getChildren(person.id).length) return;
    const point = node.renderedPosition();
    const button = existing.get(person.id) || document.createElement("button");
    retained.add(person.id);
    button.type = "button";
    button.className = "generation-toggle";
    button.dataset.parentId = person.id;
    button.textContent = person.descendantsCollapsed ? "+" : "−";
    button.setAttribute("aria-label", `${person.descendantsCollapsed ? "Expand" : "Collapse"} descendants of ${person.name}`);
    button.setAttribute("aria-expanded", String(!person.descendantsCollapsed));
    button.title = button.getAttribute("aria-label");
    button.style.left = `${point.x + node.renderedWidth() / 2}px`;
    button.style.top = `${point.y - 14}px`;
    // Branch controls remain neutral and fade with unrelated nodes, not above them.
    button.style.opacity = node.style("opacity");
    if (!button.parentElement) controls.append(button);
  });
  existing.forEach((button, id) => { if (!retained.has(id)) button.remove(); });
}

function relationshipColor(type) {
  if (type === "parent") {
    return "#33a35c";
  }
  if (type === "spouse") {
    return "#d94c4c";
  }
  return "#7a57d1";
}

function attachEvents() {
  attachContainedBoxSelection();
  refs.findPersonButton.addEventListener("click", openPersonSearch);
  document.addEventListener("pointerdown", event => {
    if (!refs.searchPanel.contains(event.target) && !refs.findPersonButton.contains(event.target)) {
      closeFloatingSearch();
    }
  });
  document.addEventListener("scroll", event => {
    if (!refs.searchPanel.hidden && !refs.searchPanel.contains(event.target)) positionPersonSearch();
  }, true);
  document.getElementById("fullscreen-button").addEventListener("click", enterCanvasFullscreen);
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) nativeFullscreenEntered = true;
    else if (nativeFullscreenEntered) restoreFullscreenView();
  });
  document.getElementById("selection-mode").addEventListener("click", () => setCanvasTool("select"));
  document.getElementById("pan-mode").addEventListener("click", () => setCanvasTool("pan"));
  cy.on("select unselect", "node", () => {
    document.getElementById("selection-count").textContent = `${cy.nodes(":selected").length} selected`;
  });
  setCanvasTool("select");
  document.getElementById("expand-generations").addEventListener("click", () => {
    state.people.forEach(person => { person.descendantsCollapsed = false; });
    saveState();
  });
  document.getElementById("generation-controls").addEventListener("click", event => {
    const button = event.target.closest("button[data-parent-id]");
    if (!button) return;
    const person = findPerson(button.dataset.parentId);
    person.descendantsCollapsed = !person.descendantsCollapsed;
    saveState();
  });
  cy.on("render", renderGenerationControls);
  refs.personForm.addEventListener("submit", handleAddPerson);
  refs.relationshipForm.addEventListener("submit", handleAddRelationship);
  refs.relationshipType.addEventListener("change", () => toggleSpouseDetails(refs.relationshipType, refs.newSpouseDetails));
  refs.personSearch.addEventListener("input", () => renderSearchResults(refs.personSearch.value));
  refs.searchResults.addEventListener("click", handleSearchResultClick);
  refs.undoButton.addEventListener("click", undo);
  refs.redoButton.addEventListener("click", redo);
  refs.toastUndoButton.addEventListener("click", undo);
  refs.manageRelationshipsButton.addEventListener("click", () => openRelationshipManager());
  refs.recycleBinButton.addEventListener("click", openRecycleBin);
  refs.confirmDeletePerson.addEventListener("click", confirmPersonDeletion);
  refs.closeRelationshipsDialog.addEventListener("click", () => refs.relationshipsDialog.close());
  refs.relationshipsList.addEventListener("click", handleRelationshipListAction);
  refs.relationshipEditorForm.addEventListener("submit", saveRelationshipEdit);
  refs.editRelationshipType.addEventListener("change", () => toggleSpouseDetails(refs.editRelationshipType, refs.editSpouseDetails));
  refs.cancelRelationshipEdit.addEventListener("click", () => refs.relationshipEditorDialog.close());
  refs.confirmDeleteRelationship.addEventListener("click", confirmRelationshipDeletion);
  refs.closeRecycleBin.addEventListener("click", () => refs.recycleBinDialog.close());
  refs.recycleBinList.addEventListener("click", handleRecycleBinAction);
  refs.layoutButton.addEventListener("click", () => runLayout(true, true));
  refs.resetViewButton.addEventListener("click", resetView);
  refs.exportButton.addEventListener("click", exportPng);
  refs.exportDataButton.addEventListener("click", exportFamilyFile);
  refs.importDataButton.addEventListener("click", () => refs.importDataInput.click());
  refs.importDataInput.addEventListener("change", importFamilyFile);
  refs.expandCanvasButton.addEventListener("click", openCanvasOnlyView);
  refs.sidebarToggleButton.addEventListener("click", toggleSidebar);
  refs.canvasTab.addEventListener("click", () => setActiveView("canvas"));
  refs.tableTab.addEventListener("click", () => setActiveView("table"));
  refs.personCancel.addEventListener("click", resetPersonForm);
  refs.peopleTableBody.addEventListener("click", handleTableActions);
  refs.resizeHandle.addEventListener("pointerdown", startSidebarResize);

  cy.on("tap", "node", async (event) => {
    const node = event.target;
    if (cy.userPanningEnabled()) {
      await exitCanvasFullscreen();
      startEditingPerson(node.id());
      return;
    }
    highlightNeighborhood(node.id());
    centerOnNode(node);
  });

  cy.on("tap", "edge", (event) => {
    openRelationshipEditor(event.target.data("relationshipKey"));
  });

  cy.on("tap", (event) => {
    if (event.target !== cy) {
      return;
    }

    if (backgroundTapTimer) {
      clearTimeout(backgroundTapTimer);
      backgroundTapTimer = null;
      clearHighlight();
      resetView();
      return;
    }

    backgroundTapTimer = setTimeout(() => {
      backgroundTapTimer = null;
      clearHighlight();
    }, 260);
  });

  cy.on("mouseover", "node", (event) => showTooltip(event.target, event.renderedPosition));
  cy.on("mousemove", "node", (event) => showTooltip(event.target, event.renderedPosition));
  cy.on("mouseout", "node", hideTooltip);

  cy.on("dragfree", "node", () => saveState());
  window.addEventListener("resize", handleWindowResize);
  window.addEventListener("keydown", handleHistoryShortcut);
}

function handleAddPerson(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const person = {
    id: editingPersonId || crypto.randomUUID(),
    name: String(form.get("name") || document.getElementById("name").value).trim(),
    gender: String(form.get("gender") || document.getElementById("gender").value),
    dateOfBirth: String(form.get("dob") || document.getElementById("dob").value),
    dateOfDeath: String(form.get("dod") || document.getElementById("dod").value || ""),
    deceased: form.get("deceased") === "on",
    notes: String(form.get("notes") || "").trim()
  };

  try {
    if (editingPersonId) {
      updatePerson(person);
      showMessage(`Updated ${person.name}.`);
    } else {
      addPerson(person);
      showMessage(`Added ${person.name}.`);
    }
    resetPersonForm();
  } catch (error) {
    showMessage(error.message, true);
  }
}

function handleAddRelationship(event) {
  event.preventDefault();
  const from = refs.personA.value;
  const to = refs.personB.value;
  const type = refs.relationshipType.value;
  const metadata = type === "spouse" ? {
    status: refs.relationshipStatus.value,
    startDate: refs.relationshipStartDate.value,
    endDate: refs.relationshipEndDate.value
  } : {};

  try {
    addRelationship({ from, to, type, ...metadata });
    showMessage(`Added ${type} relationship.`);
    // Keep the last people and relationship details ready for the next edit.
    toggleSpouseDetails(refs.relationshipType, refs.newSpouseDetails);
  } catch (error) {
    showMessage(error.message, true);
  }
}

function addPerson(personInput) {
  const person = {
    ...personInput,
    name: personInput.name.trim()
  };

  if (!person.name) {
    throw new Error("Name is required.");
  }

  if (!["male", "female"].includes(person.gender)) {
    throw new Error("Gender must be male or female.");
  }

  if (person.dateOfDeath && person.dateOfBirth && person.dateOfDeath < person.dateOfBirth) {
    throw new Error("Date of death cannot be before date of birth.");
  }

  recordHistory(`Add ${person.name}`);
  person.position = nextPersonPosition();
  state.people.push(person);
  cy.add({
    group: "nodes",
    position: person.position,
    data: {
      id: person.id,
      ...personNodeData(person),
      color: person.gender === "male" ? "#4a86e8" : "#e878b6",
      fontSize: computeNodeFontSize(person.name),
      gender: person.gender,
      dateOfBirth: person.dateOfBirth,
      dateOfDeath: person.dateOfDeath || ""
    }
  });
  populatePersonSelects();
  refreshStats();
  renderPeopleTable();
  saveState();
  if (!refs.canvasView.classList.contains("hidden")) cy.fit(cy.elements(":visible"), getFitPadding());
}

function updatePerson(personInput) {
  const existingPerson = findPerson(personInput.id);
  if (!existingPerson) {
    throw new Error("Person not found.");
  }

  const updatedPerson = {
    ...existingPerson,
    ...personInput,
    name: personInput.name.trim()
  };

  if (!updatedPerson.name) {
    throw new Error("Name is required.");
  }

  if (!["male", "female"].includes(updatedPerson.gender)) {
    throw new Error("Gender must be male or female.");
  }

  if (updatedPerson.dateOfDeath && updatedPerson.dateOfBirth && updatedPerson.dateOfDeath < updatedPerson.dateOfBirth) {
    throw new Error("Date of death cannot be before date of birth.");
  }

  recordHistory(`Edit ${updatedPerson.name}`);
  state.people = state.people.map((person) =>
    person.id === updatedPerson.id ? { ...person, ...updatedPerson } : person
  );

  const node = cy.getElementById(updatedPerson.id);
  if (node.nonempty()) {
    node.data({
      ...personNodeData(updatedPerson),
      color: updatedPerson.gender === "male" ? "#4a86e8" : "#e878b6",
      fontSize: computeNodeFontSize(updatedPerson.name),
      gender: updatedPerson.gender,
      dateOfBirth: updatedPerson.dateOfBirth,
      dateOfDeath: updatedPerson.dateOfDeath || ""
    });
  }

  populatePersonSelects();
  refreshStats();
  renderPeopleTable();
  saveState();
}

function addRelationship({ from, to, type, status = "current", startDate = "", endDate = "" }) {
  if (from === to) {
    throw new Error("Self relationships are not allowed.");
  }

  if (!findPerson(from) || !findPerson(to)) {
    throw new Error("Both people must exist.");
  }

  if (!["parent", "child", "spouse", "sibling"].includes(type)) {
    throw new Error("Unsupported relationship type.");
  }

  const normalizedFrom = type === "child" ? to : from;
  const normalizedTo = type === "child" ? from : to;
  const normalizedType = type === "child" ? "parent" : type;
  validateRelationshipDates(type, startDate, endDate);
  const metadata = normalizedType === "spouse" ? {
    status: status === "former" ? "former" : "current",
    startDate: validDateValue(startDate),
    endDate: validDateValue(endDate)
  } : {};
  const relationshipsToAdd = [];

  if (normalizedType === "parent") {
    if (createsAncestorLoop(normalizedFrom, normalizedTo, state.relationships)) {
      throw new Error("Invalid ancestor loop detected.");
    }
    relationshipsToAdd.push({ from: normalizedFrom, to: normalizedTo, type: normalizedType, ...metadata });
  } else {
    relationshipsToAdd.push(
      { from: normalizedFrom, to: normalizedTo, type: normalizedType, ...metadata },
      { from: normalizedTo, to: normalizedFrom, type: normalizedType, ...metadata }
    );
  }

  const newRelationships = relationshipsToAdd.filter(
    (relationship) => !relationshipExists(relationship.from, relationship.to, relationship.type)
  );

  if (newRelationships.length === 0) {
    throw new Error("That relationship already exists.");
  }

  recordHistory(`Add ${normalizedType} relationship`);
  newRelationships.forEach((relationship) => {
    state.relationships.push(relationship);
    cy.add({
      group: "edges",
      data: edgeData(relationship)
    });
  });

  saveState();
  refreshStats();
  renderPeopleTable();
}

function relationshipExists(from, to, type) {
  return state.relationships.some(
    (relationship) =>
      relationship.from === from && relationship.to === to && relationship.type === type
  );
}

function createsAncestorLoop(parentId, childId, relationships) {
  if (parentId === childId) {
    return true;
  }

  const stack = [parentId];
  const visited = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (current === childId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    relationships.forEach((relationship) => {
      if (relationship.type === "parent" && relationship.to === current) {
        stack.push(relationship.from);
      }
    });
  }

  return false;
}

function findPerson(personId) {
  return state.people.find((person) => person.id === personId);
}

function getParents(personId) {
  return state.relationships
    .filter((relationship) => relationship.type === "parent" && relationship.to === personId)
    .map((relationship) => relationship.from);
}

function getChildren(personId) {
  return state.relationships
    .filter((relationship) => relationship.type === "parent" && relationship.from === personId)
    .map((relationship) => relationship.to);
}

function getRelated(personId, type) {
  return state.relationships
    .filter((relationship) => relationship.type === type && relationship.from === personId)
    .map((relationship) => relationship.to);
}

function relationshipGroupKey(relationship) {
  if (relationship.type === "spouse" || relationship.type === "sibling") {
    const [first, second] = [relationship.from, relationship.to].sort();
    return `${relationship.type}:${first}:${second}`;
  }
  return `${relationship.type}:${relationship.from}:${relationship.to}`;
}

function getCanonicalRelationships(personId = null) {
  const seen = new Set();
  return state.relationships.filter((relationship) => {
    if (personId && relationship.from !== personId && relationship.to !== personId) {
      return false;
    }
    const key = relationshipGroupKey(relationship);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function findRelationshipByKey(key) {
  return state.relationships.find((relationship) => relationshipGroupKey(relationship) === key);
}

function relationshipDescription(relationship) {
  const fromName = nameForId(relationship.from);
  const toName = nameForId(relationship.to);
  if (relationship.type === "parent") {
    return `${fromName} is parent of ${toName}`;
  }
  if (relationship.type === "spouse") {
    return `${fromName} and ${toName} are ${relationship.status === "former" ? "former spouses" : "spouses"}`;
  }
  return `${fromName} and ${toName} are siblings`;
}

function relationshipMetadataText(relationship) {
  if (relationship.type !== "spouse") {
    return capitalize(relationship.type);
  }
  const parts = [relationship.status === "former" ? "Former" : "Current"];
  if (relationship.startDate) {
    parts.push(`from ${formatDate(relationship.startDate)}`);
  }
  if (relationship.endDate) {
    parts.push(`to ${formatDate(relationship.endDate)}`);
  }
  return parts.join(" ");
}

function openRelationshipManager(personId = null) {
  relationshipFilterPersonId = personId;
  refs.relationshipsDialogTitle.textContent = personId
    ? `Relationships for ${nameForId(personId)}`
    : "Manage Relationships";
  renderRelationshipList();
  refs.relationshipsDialog.showModal();
}

function renderRelationshipList() {
  const relationships = getCanonicalRelationships(relationshipFilterPersonId);
  if (!relationships.length) {
    refs.relationshipsList.innerHTML = '<p class="empty-state">No relationships found.</p>';
    return;
  }

  refs.relationshipsList.innerHTML = relationships.map((relationship) => {
    const key = relationshipGroupKey(relationship);
    return `
      <div class="relationship-row">
        <div>
          <strong>${escapeHtml(relationshipDescription(relationship))}</strong>
          <small>${escapeHtml(relationshipMetadataText(relationship))}</small>
        </div>
        <div class="row-actions">
          <button type="button" class="icon-button" data-relationship-action="edit" data-relationship-key="${escapeHtml(key)}" aria-label="Edit relationship">✎</button>
          <button type="button" class="icon-button delete-button" data-relationship-action="delete" data-relationship-key="${escapeHtml(key)}" aria-label="Delete relationship">×</button>
        </div>
      </div>`;
  }).join("");
}

function handleRelationshipListAction(event) {
  const button = event.target.closest("button[data-relationship-action]");
  if (!button) {
    return;
  }
  const key = button.dataset.relationshipKey;
  if (button.dataset.relationshipAction === "edit") {
    openRelationshipEditor(key);
  } else {
    requestRelationshipDeletion(key);
  }
}

function openRelationshipEditor(key) {
  const relationship = findRelationshipByKey(key);
  if (!relationship) {
    return;
  }
  populateEditPersonSelects();
  refs.editRelationshipKey.value = key;
  refs.editPersonA.value = relationship.from;
  refs.editPersonB.value = relationship.to;
  refs.editRelationshipType.value = relationship.type;
  refs.editRelationshipStatus.value = relationship.status === "former" ? "former" : "current";
  refs.editRelationshipStartDate.value = relationship.startDate || "";
  refs.editRelationshipEndDate.value = relationship.endDate || "";
  toggleSpouseDetails(refs.editRelationshipType, refs.editSpouseDetails);
  refs.relationshipEditorDialog.showModal();
}

function saveRelationshipEdit(event) {
  event.preventDefault();
  const oldKey = refs.editRelationshipKey.value;
  const oldRelationship = findRelationshipByKey(oldKey);
  if (!oldRelationship) {
    refs.relationshipEditorDialog.close();
    return;
  }

  const inputType = refs.editRelationshipType.value;
  const inputFrom = refs.editPersonA.value;
  const inputTo = refs.editPersonB.value;
  const normalizedType = inputType === "child" ? "parent" : inputType;
  const normalizedFrom = inputType === "child" ? inputTo : inputFrom;
  const normalizedTo = inputType === "child" ? inputFrom : inputTo;
  const startDate = refs.editRelationshipStartDate.value;
  const endDate = refs.editRelationshipEndDate.value;

  try {
    if (normalizedFrom === normalizedTo) {
      throw new Error("Self relationships are not allowed.");
    }
    validateRelationshipDates(normalizedType, startDate, endDate);
    const remaining = state.relationships.filter((relationship) => relationshipGroupKey(relationship) !== oldKey);
    if (normalizedType === "parent" && createsAncestorLoop(normalizedFrom, normalizedTo, remaining)) {
      throw new Error("Invalid ancestor loop detected.");
    }
    const candidate = { from: normalizedFrom, to: normalizedTo, type: normalizedType };
    const newKey = relationshipGroupKey(candidate);
    if (remaining.some((relationship) => relationshipGroupKey(relationship) === newKey)) {
      throw new Error("That relationship already exists.");
    }

    const metadata = normalizedType === "spouse" ? {
      status: refs.editRelationshipStatus.value === "former" ? "former" : "current",
      startDate: validDateValue(startDate),
      endDate: validDateValue(endDate)
    } : {};
    recordHistory("Edit relationship");
    state.relationships = remaining;
    state.relationships.push({ ...candidate, ...metadata });
    if (normalizedType === "spouse" || normalizedType === "sibling") {
      state.relationships.push({ from: normalizedTo, to: normalizedFrom, type: normalizedType, ...metadata });
    }
    refreshGraphFromState();
    refs.relationshipEditorDialog.close();
    if (refs.relationshipsDialog.open) {
      renderRelationshipList();
    }
    showMessage("Relationship updated.");
  } catch (error) {
    showMessage(error.message, true);
  }
}

function requestRelationshipDeletion(key) {
  const relationship = findRelationshipByKey(key);
  if (!relationship) {
    return;
  }
  pendingDeleteRelationshipKey = key;
  refs.deleteRelationshipCopy.textContent = `${relationshipDescription(relationship)} will be removed.`;
  refs.deleteRelationshipDialog.showModal();
}

function confirmRelationshipDeletion() {
  if (!pendingDeleteRelationshipKey) {
    return;
  }
  const relationship = findRelationshipByKey(pendingDeleteRelationshipKey);
  if (!relationship) {
    pendingDeleteRelationshipKey = null;
    return;
  }
  recordHistory("Delete relationship");
  state.relationships = state.relationships.filter(
    (entry) => relationshipGroupKey(entry) !== pendingDeleteRelationshipKey
  );
  pendingDeleteRelationshipKey = null;
  refreshGraphFromState();
  if (refs.relationshipsDialog.open) {
    refs.relationshipsDialog.close();
  }
  showMessage("Relationship deleted.");
  showUndoToast("Relationship deleted.");
}

function toggleSpouseDetails(typeSelect, detailsElement) {
  detailsElement.classList.toggle("hidden", typeSelect.value !== "spouse");
}

function validateRelationshipDates(type, startDate, endDate) {
  if (type === "spouse" && startDate && endDate && endDate < startDate) {
    throw new Error("Relationship end date cannot be before its start date.");
  }
}

function validDateValue(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value : "";
}

function highlightNeighborhood(personId) {
  clearHighlight();

  const connectedIds = new Set([
    ...getParents(personId),
    ...getChildren(personId),
    ...getRelated(personId, "sibling"),
    ...getRelated(personId, "spouse")
  ]);

  cy.elements().addClass("faded");
  cy.getElementById(personId).removeClass("faded").addClass("highlighted");

  connectedIds.forEach((id) => {
    cy.getElementById(id).removeClass("faded").addClass("highlighted");
  });

  cy.edges().forEach((edge) => {
    const source = edge.source().id();
    const target = edge.target().id();
    if (
      (source === personId && connectedIds.has(target)) ||
      (target === personId && connectedIds.has(source))
    ) {
      edge.removeClass("faded").addClass("highlighted");
    }
  });
}

function clearHighlight() {
  cy.elements().removeClass("faded highlighted");
}

function centerOnNode(node) {
  cy.animate(
    {
      center: { eles: node },
      duration: 280
    },
    {
      easing: "ease-out-cubic"
    }
  );
}

function runLayout(fitView = false, forceAutoLayout = false) {
  if (!state.people.length) return;
  const hasSavedPositions = state.people.some((person) => person.position);
  const layoutName = forceAutoLayout ? "cose" : hasSavedPositions ? "preset" : "cose";
  const layout = cy.layout({
    name: layoutName,
    animate: true,
    fit: fitView,
    padding: getFitPadding(),
    nodeRepulsion: 160000,
    idealEdgeLength: 120
  });

  if (hasSavedPositions && layoutName === "preset") {
    state.people.forEach((person) => {
      if (person.position) {
        const node = cy.getElementById(person.id);
        if (node.nonempty()) {
          node.position(person.position);
        }
      }
    });
  }

  if (layoutName !== "preset") {
    cy.once("layoutstop", () => {
      saveState();
      if (fitView) {
        cy.fit(undefined, getFitPadding());
      }
    });
  }

  layout.run();

  if (fitView) {
    setTimeout(() => cy.fit(undefined, getFitPadding()), 350);
  }
}

function resetView() {
  cy.fit(undefined, getFitPadding());
}

function exportPng() {
  const dataUrl = cy.png({ full: true, scale: 2, bg: "#fffaf0" });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = "family-graph.png";
  link.click();
}

function exportFamilyFile() {
  saveNodePositions();

  const exportPayload = {
    version: 1,
    name: treeList.find(tree => tree.id === activeTreeId)?.name || "Family Tree",
    exportedAt: new Date().toISOString(),
    data: {
      people: state.people,
      relationships: state.relationships
    }
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${exportPayload.name.replace(/[^\p{L}\p{N} _-]/gu, "_")}.familygraph.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.getElementById("file-status").textContent = `Downloaded ${exportPayload.name}.`;
}

function importFamilyFile(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const generation = sessionGeneration;
  const reader = new FileReader();
  reader.onload = () => {
    if (generation !== sessionGeneration || treeChanging || !treeCatalog) return;
    try {
      const parsed = JSON.parse(String(reader.result));
      if (parsed?.version !== undefined && parsed.version !== 1) throw new Error("Unsupported family file version.");
      const importedData =
        parsed && Array.isArray(parsed.people) && Array.isArray(parsed.relationships)
          ? parsed
          : parsed?.data;

      if (!importedData || !Array.isArray(importedData.people) || !Array.isArray(importedData.relationships)) {
        throw new Error("Invalid family graph file.");
      }

      validateFamilyData(importedData);
      pendingImport = {
        id: crypto.randomUUID(),
        name: (typeof parsed.name === "string" ? parsed.name : file.name.replace(/(?:\.familygraph)?\.json$/i, "")).trim().slice(0, 100) || "Imported Family Tree",
        document: { people: importedData.people, relationships: importedData.relationships, recycleBin: [] }
      };
      openTreeDialog("import");
    } catch (error) {
      document.getElementById("file-status").textContent = error.message || "Failed to import family graph file.";
    } finally {
      refs.importDataInput.value = "";
    }
  };
  reader.onerror = () => {
    if (generation === sessionGeneration) document.getElementById("file-status").textContent = "Could not read the family file. Please try again.";
    refs.importDataInput.value = "";
  };
  reader.readAsText(file);
}

function showTooltip(node, renderedPosition) {
  const person = findPerson(node.id());
  if (!person) {
    return;
  }

  refs.tooltip.innerHTML = `
    <strong>${escapeHtml(person.name)}</strong>
    <div>${escapeHtml(capitalize(person.gender))}${person.deceased || person.dateOfDeath ? " · Deceased" : ""}</div>
    <div>DOB: ${formatDate(person.dateOfBirth)}</div>
    <div>DOD: ${person.dateOfDeath ? formatDate(person.dateOfDeath) : "N/A"}</div>
    ${person.notes ? `<div>${escapeHtml(person.notes)}</div>` : ""}
  `;
  refs.tooltip.classList.remove("hidden");
  refs.tooltip.style.left = `${renderedPosition.x + 22}px`;
  refs.tooltip.style.top = `${renderedPosition.y + 18}px`;
}

function hideTooltip() {
  refs.tooltip.classList.add("hidden");
}

function populatePersonSelects() {
  const previousA = refs.personA.value;
  const previousB = refs.personB.value;
  const options = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`)
    .join("");

  refs.personA.innerHTML = options;
  refs.personB.innerHTML = options;
  if (state.people.some(person => person.id === previousA)) refs.personA.value = previousA;
  if (state.people.some(person => person.id === previousB)) refs.personB.value = previousB;
}

function populateEditPersonSelects() {
  const options = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`)
    .join("");
  refs.editPersonA.innerHTML = options;
  refs.editPersonB.innerHTML = options;
}

function refreshStats() {
  refs.stats.textContent = `${state.people.length} people, ${state.relationships.length} stored relationships`;
}

function renderPeopleTable() {
  refs.peopleTableBody.innerHTML = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => {
      const parents = getParents(person.id).map(nameForId).join(", ") || "None";
      const children = getChildren(person.id).map(nameForId).join(", ") || "None";
      const siblings = getRelated(person.id, "sibling").map(nameForId).join(", ") || "None";
      const spouses = getRelated(person.id, "spouse").map(nameForId).join(", ") || "None";

      return `
        <tr>
          <td>${escapeHtml(person.name)}</td>
          <td>${capitalize(person.gender)}</td>
          <td>${formatDate(person.dateOfBirth)}</td>
          <td>${formatDate(person.dateOfDeath)}</td>
          <td>${escapeHtml(parents)}</td>
          <td>${escapeHtml(children)}</td>
          <td>${escapeHtml(siblings)}</td>
          <td>${escapeHtml(spouses)}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="icon-button" data-action="relationships" data-person-id="${escapeHtml(person.id)}" aria-label="Manage relationships for ${escapeHtml(person.name)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              </button>
              <button type="button" class="icon-button" data-action="edit" data-person-id="${escapeHtml(person.id)}" aria-label="Edit ${escapeHtml(person.name)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                </svg>
              </button>
              <button type="button" class="icon-button delete-button" data-action="delete" data-person-id="${escapeHtml(person.id)}" aria-label="Delete ${escapeHtml(person.name)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M8 6V4h8v2"></path>
                  <path d="M19 6l-1 14H6L5 6"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function setActiveView(view) {
  const showCanvas = view === "canvas";
  refs.canvasView.classList.toggle("hidden", !showCanvas);
  refs.tableView.classList.toggle("hidden", showCanvas);
  refs.canvasTab.classList.toggle("active", showCanvas);
  refs.tableTab.classList.toggle("active", !showCanvas);
  refs.canvasTab.setAttribute("aria-selected", String(showCanvas));
  refs.tableTab.setAttribute("aria-selected", String(!showCanvas));

  if (showCanvas) {
    clearHighlight();
    setTimeout(() => {
      cy.resize();
      cy.fit(undefined, getFitPadding());
    }, 40);
  }
}

function applyMode() {
  if (!isCanvasOnlyMode) {
    return;
  }

  document.body.classList.add("canvas-only-mode");
}

function openCanvasOnlyView() {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "canvas");
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

function toggleSidebar() {
  const isCollapsed = document.body.classList.toggle("sidebar-collapsed");
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  updateSidebarToggle(isCollapsed);

  requestAnimationFrame(() => {
    cy.resize();
    cy.fit(undefined, getFitPadding());
  });
}

function restoreSidebarState() {
  if (isCanvasOnlyMode) {
    return;
  }

  const isCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  document.body.classList.toggle("sidebar-collapsed", isCollapsed);
  updateSidebarToggle(isCollapsed);
}

function updateSidebarToggle(isCollapsed) {
  const action = isCollapsed ? "Show" : "Hide";
  refs.sidebarToggleButton.setAttribute("aria-expanded", String(!isCollapsed));
  refs.sidebarToggleButton.setAttribute("aria-label", `${action} sidebar`);
  refs.sidebarToggleButton.title = `${action} sidebar (Cmd/Ctrl + \\)`;
}

function openPersonSearch() {
  if (!refs.searchPanel.hidden) {
    closeFloatingSearch();
    return;
  }
  refs.searchPanel.hidden = false;
  refs.findPersonButton.setAttribute("aria-expanded", "true");
  positionPersonSearch();
  refs.personSearch.focus();
  refs.personSearch.select();
}

function positionPersonSearch() {
  const anchor = refs.findPersonButton.getBoundingClientRect();
  const panel = refs.searchPanel.getBoundingClientRect();
  refs.searchPanel.style.left = `${Math.max(12, Math.min(anchor.right - panel.width, innerWidth - panel.width - 12))}px`;
  refs.searchPanel.style.top = `${Math.max(12, Math.min(anchor.bottom + 8, innerHeight - panel.height - 12))}px`;
}

function closeFloatingSearch() {
  refs.searchPanel.hidden = true;
  refs.findPersonButton.setAttribute("aria-expanded", "false");
}

async function enterCanvasFullscreen() {
  if (fullscreenView) return;
  fullscreenView = refs.tableView.classList.contains("hidden") ? "canvas" : "table";
  closeFloatingSearch();
  hideTooltip();
  hideUndoToast();
  setActiveView("canvas");
  document.body.classList.add("canvas-fullscreen");
  refs.canvasView.setAttribute("tabindex", "-1");
  refs.canvasView.focus();
  handleWindowResize();
  try {
    await document.documentElement.requestFullscreen?.();
    // Esc can be pressed while the browser request is still pending.
    if (!fullscreenView && document.fullscreenElement) await document.exitFullscreen();
  } catch { /* Keep the same canvas-only layout when native fullscreen is unavailable. */ }
  handleWindowResize();
}

function restoreFullscreenView() {
  if (!fullscreenView) return;
  const previousView = fullscreenView;
  fullscreenView = null;
  nativeFullscreenEntered = false;
  document.body.classList.remove("canvas-fullscreen");
  refs.canvasView.removeAttribute("tabindex");
  setActiveView(previousView);
  requestAnimationFrame(handleWindowResize);
  document.getElementById("fullscreen-button").focus({ preventScroll: true });
}

async function exitCanvasFullscreen() {
  if (!fullscreenView) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch { /* Still restore the app layout if the browser already exited. */ }
  finally {
    restoreFullscreenView();
  }
}

function attachContainedBoxSelection() {
  let gesture = null;
  cy.on("tapstart", event => {
    // Capture icon bounds before selection styling changes the border/size.
    gesture = {
      start: { ...event.position },
      selected: new Set(cy.elements(":selected").map(element => element.id())),
      icons: cy.nodes(":visible").map(node => {
        const { x, y } = node.position();
        return { id: node.id(), x1: x - node.outerWidth() / 2, x2: x + node.outerWidth() / 2,
          y1: y - node.outerHeight() / 2, y2: y + node.outerHeight() / 2 };
      })
    };
  });
  cy.on("boxend", event => {
    if (!gesture || event.originalEvent?.type.startsWith("touch")) return;
    const { start, selected, icons } = gesture;
    gesture = null;
    const end = event.position;
    const x1 = Math.min(start.x, end.x), x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y), y2 = Math.max(start.y, end.y);
    const enclosed = new Set(icons.filter(icon => icon.x1 >= x1 && icon.x2 <= x2 && icon.y1 >= y1 && icon.y2 <= y2).map(icon => icon.id));
    // Cytoscape 3.29 emits boxend before its intersection-based selection.
    // Correct that result afterwards, retaining the existing additive selection.
    queueMicrotask(() => cy.batch(() => {
      cy.elements(":selected").filter(element => !selected.has(element.id()) && !enclosed.has(element.id())).unselect();
      cy.nodes(":visible").filter(node => enclosed.has(node.id())).select();
    }));
  });
}

function handleWindowResize() {
  if (!cy) {
    return;
  }

  cy.resize();
  cy.fit(undefined, getFitPadding());
  if (!refs.searchPanel.hidden) positionPersonSearch();
}

function setCanvasTool(tool) {
  const selecting = tool === "select";
  cy.userPanningEnabled(!selecting);
  document.getElementById("selection-mode").setAttribute("aria-pressed", String(selecting));
  document.getElementById("pan-mode").setAttribute("aria-pressed", String(!selecting));
  refs.canvasView.classList.toggle("select-mode", selecting);
}

function handleTableActions(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, personId } = button.dataset;
  if (action === "edit") {
    startEditingPerson(personId);
    return;
  }

  if (action === "relationships") {
    openRelationshipManager(personId);
    return;
  }

  if (action === "delete") {
    requestPersonDeletion(personId);
  }
}

function startEditingPerson(personId) {
  const person = findPerson(personId);
  if (!person) {
    showMessage("Person not found.", true);
    return;
  }

  document.body.classList.remove("canvas-only-mode");
  requestAnimationFrame(handleWindowResize);
  if (document.body.classList.contains("sidebar-collapsed")) {
    toggleSidebar();
  }
  editingPersonId = personId;
  document.getElementById("name").value = person.name;
  document.getElementById("gender").value = person.gender;
  document.getElementById("dob").value = person.dateOfBirth || "";
  document.getElementById("dod").value = person.dateOfDeath || "";
  document.getElementById("deceased").checked = !!(person.deceased || person.dateOfDeath);
  document.getElementById("person-notes").value = person.notes || "";
  refs.personSubmit.textContent = "Save Changes";
  document.getElementById("person-form-title").textContent = "Edit Person";
  refs.personCancel.classList.remove("hidden-button");
  refs.personForm.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("name").focus({ preventScroll: true });
  showMessage(`Editing ${person.name}.`);
}

function resetPersonForm() {
  editingPersonId = null;
  refs.personForm.reset();
  document.getElementById("gender").value = "male";
  refs.personSubmit.textContent = "Add Person";
  document.getElementById("person-form-title").textContent = "Add Person";
  refs.personCancel.classList.add("hidden-button");
}

function requestPersonDeletion(personId) {
  const person = findPerson(personId);
  if (!person) {
    showMessage("Person not found.", true);
    return;
  }

  const connectedCount = getCanonicalRelationships(personId).length;
  pendingDeletePersonId = personId;
  refs.deletePersonTitle.textContent = `Delete ${person.name}?`;
  refs.deletePersonCopy.textContent = connectedCount
    ? `${connectedCount} connected relationship${connectedCount === 1 ? "" : "s"} will also be removed. The person can be restored from the Recycle Bin.`
    : "This person can be restored from the Recycle Bin.";
  refs.deletePersonDialog.showModal();
}

function confirmPersonDeletion() {
  const personId = pendingDeletePersonId;
  const person = findPerson(personId);
  if (!person) {
    pendingDeletePersonId = null;
    return;
  }

  recordHistory(`Delete ${person.name}`);
  const relationships = state.relationships.filter(
    (relationship) => relationship.from === personId || relationship.to === personId
  );
  recycleBin.unshift({
    id: crypto.randomUUID(),
    deletedAt: new Date().toISOString(),
    person: structuredClone(person),
    relationships: structuredClone(relationships)
  });
  saveRecycleBin();
  state.people = state.people.filter((entry) => entry.id !== personId);
  state.relationships = state.relationships.filter(
    (relationship) => relationship.from !== personId && relationship.to !== personId
  );

  if (editingPersonId === personId) {
    resetPersonForm();
  }

  pendingDeletePersonId = null;
  refreshGraphFromState();
  showMessage(`Moved ${person.name} to the Recycle Bin.`);
  showUndoToast(`${person.name} moved to the Recycle Bin.`);
}

function startSidebarResize(event) {
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = refs.sidebar.getBoundingClientRect().width;

  refs.resizeHandle.setPointerCapture(event.pointerId);

  function onPointerMove(moveEvent) {
    const nextWidth = Math.min(460, Math.max(220, startWidth + (moveEvent.clientX - startX)));
    document.documentElement.style.setProperty("--sidebar-width", `${nextWidth}px`);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(nextWidth));
    cy.resize();
  }

  function onPointerUp() {
    refs.resizeHandle.removeEventListener("pointermove", onPointerMove);
    refs.resizeHandle.removeEventListener("pointerup", onPointerUp);
    refs.resizeHandle.removeEventListener("pointercancel", onPointerUp);
    cy.resize();
  }

  refs.resizeHandle.addEventListener("pointermove", onPointerMove);
  refs.resizeHandle.addEventListener("pointerup", onPointerUp);
  refs.resizeHandle.addEventListener("pointercancel", onPointerUp);
}

function restoreSidebarWidth() {
  const savedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  if (savedWidth >= 220 && savedWidth <= 460) {
    document.documentElement.style.setProperty("--sidebar-width", `${savedWidth}px`);
  }
}

function getFitPadding() {
  return isCanvasOnlyMode ? 90 : 70;
}

function snapshotAppState(description = "Change") {
  saveNodePositions();
  return {
    description,
    state: structuredClone({ people: state.people, relationships: state.relationships }),
    recycleBin: structuredClone(recycleBin)
  };
}

function recordHistory(description) {
  hideUndoToast();
  undoStack.push(snapshotAppState(description));
  if (undoStack.length > HISTORY_LIMIT) {
    undoStack.shift();
  }
  redoStack = [];
  updateHistoryControls();
}

function undo() {
  const snapshot = undoStack.pop();
  if (!snapshot) {
    return;
  }
  redoStack.push(snapshotAppState(snapshot.description));
  restoreSnapshot(snapshot);
  showMessage(`Undid: ${snapshot.description}.`);
  hideUndoToast();
}

function redo() {
  const snapshot = redoStack.pop();
  if (!snapshot) {
    return;
  }
  undoStack.push(snapshotAppState(snapshot.description));
  restoreSnapshot(snapshot);
  showMessage(`Redid: ${snapshot.description}.`);
}

function restoreSnapshot(snapshot) {
  state.people = structuredClone(snapshot.state.people);
  state.relationships = structuredClone(snapshot.state.relationships);
  recycleBin = structuredClone(snapshot.recycleBin);
  saveRecycleBin();
  refreshGraphFromState();
  updateHistoryControls();
  if (refs.relationshipsDialog.open) {
    renderRelationshipList();
  }
  if (refs.recycleBinDialog.open) {
    renderRecycleBin();
  }
}

function updateHistoryControls() {
  refs.undoButton.disabled = undoStack.length === 0;
  refs.redoButton.disabled = redoStack.length === 0;
  refs.undoButton.title = undoStack.length ? `Undo ${undoStack.at(-1).description}` : "Nothing to undo";
  refs.redoButton.title = redoStack.length ? `Redo ${redoStack.at(-1).description}` : "Nothing to redo";
}

function refreshGraphFromState() {
  cy.elements().remove();
  cy.add(buildElements());
  populatePersonSelects();
  refreshStats();
  renderPeopleTable();
  renderSearchResults(refs.personSearch.value);
  updateRecycleBinCount();
  resetPersonForm();
  clearHighlight();
  saveState();
  runLayout(true, false);
}

function showUndoToast(message) {
  clearTimeout(toastTimer);
  refs.undoToastMessage.textContent = message;
  refs.undoToast.hidden = false;
  toastTimer = setTimeout(hideUndoToast, 7000);
}

function hideUndoToast() {
  clearTimeout(toastTimer);
  refs.undoToast.hidden = true;
}

function saveRecycleBin() {
  updateRecycleBinCount();
}

function updateRecycleBinCount() {
  refs.recycleCount.textContent = recycleBin.length ? `(${recycleBin.length})` : "";
}

function openRecycleBin() {
  renderRecycleBin();
  refs.recycleBinDialog.showModal();
}

function renderRecycleBin() {
  if (!recycleBin.length) {
    refs.recycleBinList.innerHTML = '<p class="empty-state">The Recycle Bin is empty.</p>';
    return;
  }
  refs.recycleBinList.innerHTML = recycleBin.map((entry) => `
    <div class="relationship-row">
      <div>
        <strong>${escapeHtml(entry.person.name)}</strong>
        <small>Deleted ${escapeHtml(new Date(entry.deletedAt).toLocaleString())} · ${getCanonicalRelationshipCount(entry.relationships)} relationship(s)</small>
      </div>
      <div class="row-actions">
        <button type="button" class="secondary-button" data-recycle-action="restore" data-recycle-id="${escapeHtml(entry.id)}">Restore</button>
        <button type="button" class="danger-button" data-recycle-action="purge" data-recycle-id="${escapeHtml(entry.id)}">Delete permanently</button>
      </div>
    </div>`).join("");
}

function getCanonicalRelationshipCount(relationships) {
  return new Set(relationships.map(relationshipGroupKey)).size;
}

function handleRecycleBinAction(event) {
  const button = event.target.closest("button[data-recycle-action]");
  if (!button) {
    return;
  }
  const index = recycleBin.findIndex((entry) => entry.id === button.dataset.recycleId);
  if (index < 0) {
    return;
  }
  const entry = recycleBin[index];
  recordHistory(`${button.dataset.recycleAction === "restore" ? "Restore" : "Permanently delete"} ${entry.person.name}`);
  recycleBin.splice(index, 1);

  if (button.dataset.recycleAction === "restore") {
    const deletedPersonId = entry.person.id;
    const restoredPersonId = findPerson(deletedPersonId) ? crypto.randomUUID() : deletedPersonId;
    entry.person.id = restoredPersonId;
    state.people.push(entry.person);
    const restoredRelationships = entry.relationships
      .map((relationship) => ({
        ...relationship,
        from: relationship.from === deletedPersonId ? restoredPersonId : relationship.from,
        to: relationship.to === deletedPersonId ? restoredPersonId : relationship.to
      }))
      .filter((relationship) => findPerson(relationship.from) && findPerson(relationship.to));
    state.relationships.push(...restoredRelationships);
    normalizeState();
    showMessage(`Restored ${entry.person.name}.`);
  } else {
    showMessage(`Permanently deleted ${entry.person.name}.`);
  }
  saveRecycleBin();
  refreshGraphFromState();
  renderRecycleBin();
  if (button.dataset.recycleAction === "purge") {
    showUndoToast(`${entry.person.name} deleted.`);
  }
}

function renderSearchResults(query) {
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    refs.searchResults.innerHTML = "";
    return;
  }
  const matches = state.people
    .filter((person) => person.name.toLocaleLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 12);
  refs.searchResults.innerHTML = matches.length
    ? matches.map((person) => `<button type="button" class="search-result" data-person-id="${escapeHtml(person.id)}">${escapeHtml(person.name)}</button>`).join("")
    : '<p class="search-empty">No matching people.</p>';
  if (!refs.searchPanel.hidden) positionPersonSearch();
}

function handleSearchResultClick(event) {
  const button = event.target.closest("button[data-person-id]");
  if (!button) {
    return;
  }
  jumpToPerson(button.dataset.personId);
}

function jumpToPerson(personId) {
  // Search must reveal its result even when an ancestor branch is folded.
  state.people.forEach(person => {
    if (person.descendantsCollapsed && descendantsOf(person.id).has(personId)) person.descendantsCollapsed = false;
  });
  saveState();
  const node = cy.getElementById(personId);
  if (!node.nonempty()) {
    return;
  }
  setActiveView("canvas");
  setTimeout(() => {
    highlightNeighborhood(personId);
    cy.animate(
      { center: { eles: node }, zoom: Math.max(cy.zoom(), 1.15), duration: 350 },
      { easing: "ease-out-cubic" }
    );
  }, 70);
  refs.personSearch.value = nameForId(personId);
  refs.searchResults.innerHTML = "";
  closeFloatingSearch();
  showMessage(`Centered on ${nameForId(personId)}.`);
}

function handleHistoryShortcut(event) {
  if (event.key === "Escape" && fullscreenView) {
    event.preventDefault();
    exitCanvasFullscreen();
    return;
  }
  if (event.key === "Escape" && !refs.searchPanel.hidden) {
    closeFloatingSearch();
    refs.findPersonButton.focus();
  }
  if (cloudApplying || !activeUserId || document.querySelector("dialog[open]")) return;
  if (!(event.metaKey || event.ctrlKey) || event.altKey) {
    return;
  }
  if ((event.code === "Backslash" || event.key === "\\") && !event.shiftKey && !document.body.classList.contains("canvas-only-mode") && !fullscreenView) {
    event.preventDefault();
    if (!event.repeat) toggleSidebar();
    return;
  }
  if (event.target.closest("input, textarea, select, [contenteditable]")) return;
  const key = event.key.toLocaleLowerCase();
  if (key === "z" && !event.shiftKey) {
    event.preventDefault();
    undo();
  } else if (key === "y" || (key === "z" && event.shiftKey)) {
    event.preventDefault();
    redo();
  }
}

function showMessage(text, isError = false) {
  refs.message.textContent = text;
  refs.message.style.color = isError ? "#b00020" : "#746c60";
}

function saveState() {
  saveNodePositions();
  if (cy) applyGenerationVisibility();
  if (!cloudApplying && cloudStore) {
    cloudStore.queue({ people: state.people, relationships: state.relationships, recycleBin });
  }
  document.getElementById("empty-canvas").hidden = state.people.length > 0;
}

function saveNodePositions() {
  if (!cy) {
    return;
  }

  state.people = state.people.map((person) => {
    const node = cy.getElementById(person.id);
    if (!node.nonempty()) {
      return person;
    }

    return {
      ...person,
      position: node.position()
    };
  });
}

function formatDate(dateString) {
  if (!dateString) {
    return "N/A";
  }

  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function computeNodeFontSize(name) {
  const length = name.trim().length;
  if (length <= 7) {
    return 11;
  }
  if (length <= 10) {
    return 9;
  }
  if (length <= 13) {
    return 7.2;
  }
  if (length <= 16) {
    return 6.3;
  }
  return 5.6;
}

function nameForId(personId) {
  return findPerson(personId)?.name || personId;
}

function capitalize(value) {
  if (!value) {
    return "N/A";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function reportSync(status, detail = "") {
  const labels = {
    pending: "Unsaved changes…", saving: "Saving…", saved: "Saved to cloud",
    error: "Not saved. Check your connection and retry.",
    conflict: "This tree changed elsewhere. Export your draft before reloading the cloud copy."
  };
  document.getElementById("sync-status").textContent = detail || labels[status];
  document.getElementById("retry-save").hidden = status !== "error";
  document.getElementById("reload-cloud").hidden = status !== "conflict";
}

async function startCloudAuth() {
  const message = document.getElementById("auth-message");
  try {
    if (!window.supabase || !window.FAMILY_SUPABASE) {
      throw new Error("Sign-in could not load. Check your internet connection and reload.");
    }
    authClient = window.supabase.createClient(FAMILY_SUPABASE.url, FAMILY_SUPABASE.publishableKey, {
      auth: { storageKey: "family-graph-auth-v1", persistSession: true, autoRefreshToken: true }
    });
    document.getElementById("auth-form").addEventListener("submit", (event) => {
      event.preventDefault();
      submitAuth(false);
    });
    document.getElementById("sign-up").addEventListener("click", () => submitAuth(true));
    document.getElementById("sign-out").addEventListener("click", signOutAccount);
    document.getElementById("auth-sign-out").addEventListener("click", signOutAccount);
    document.getElementById("tree-select").addEventListener("change", event => changeTree(event.target.value));
    document.getElementById("new-tree").addEventListener("click", () => openTreeDialog("create"));
    document.getElementById("rename-tree").addEventListener("click", () => openTreeDialog("rename"));
    document.getElementById("cancel-tree").addEventListener("click", () => document.getElementById("tree-dialog").close());
    document.getElementById("tree-form").addEventListener("submit", submitTreeForm);
    document.getElementById("retry-save").addEventListener("click", () => cloudStore?.flush().catch(() => {}));
    document.getElementById("retry-load").addEventListener("click", retryAccountLoad);
    document.getElementById("reload-cloud").addEventListener("click", async () => {
      if (!window.confirm("Discard this tab's unsaved draft and load the latest cloud copy? Use Export Tree first if you want to keep your draft.")) return;
      try { sessionStorage.removeItem(cloudStore.key); } catch { /* Retry can still load the cloud. */ }
      await retryAccountLoad();
    });
    window.addEventListener("online", () => cloudStore?.flush().catch(() => {}));
    window.addEventListener("beforeunload", (event) => {
      if (cloudStore?.pending) { event.preventDefault(); event.returnValue = ""; }
    });
    const legacy = document.getElementById("legacy-backup");
    legacy.hidden = !localStorage.getItem(STORAGE_KEY);
    legacy.addEventListener("click", () => {
      try {
        const previous = JSON.parse(localStorage.getItem(STORAGE_KEY));
        downloadFamilyJson(previous, "previous-browser-tree.familygraph.json");
      } catch { message.textContent = "The previous browser data could not be read."; }
    });
    // Do not call async Supabase methods inside its auth event callback.
    authClient.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => applyAccountSession(session), 0);
    });
    const { data, error } = await authClient.auth.getSession();
    if (error) throw error;
    await applyAccountSession(data.session);
  } catch (error) {
    message.textContent = error.message;
  }
}

async function submitAuth(createAccount) {
  const form = document.getElementById("auth-form");
  if (!form.reportValidity()) return;
  const message = document.getElementById("auth-message");
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const buttons = [document.getElementById("sign-in"), document.getElementById("sign-up")];
  buttons.forEach((button) => { button.disabled = true; });
  message.textContent = createAccount ? "Creating account…" : "Signing in…";
  try {
    const redirect = new URL(window.location.href);
    redirect.search = "";
    redirect.hash = "";
    const { data, error } = createAccount
      ? await authClient.auth.signUp({ email, password, options: { emailRedirectTo: redirect.href } })
      : await authClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    document.getElementById("auth-password").value = "";
    if (data.session) await applyAccountSession(data.session);
    else message.textContent = "Check your email for confirmation, then return here to sign in. If you already have an account, use Sign in.";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

async function retryAccountLoad() {
  const { data, error } = await authClient.auth.getSession();
  if (error) { document.getElementById("auth-message").textContent = error.message; return; }
  await applyAccountSession(data.session, true);
}

async function applyAccountSession(session, force = false, requestedTreeId = null) {
  const user = session?.user;
  if (!force && user && user.id === activeUserId) return;
  const generation = ++sessionGeneration;
  exitCanvasFullscreen();
  closeFloatingSearch();
  pendingImport = null;
  document.getElementById("file-status").textContent = "";
  cloudStore?.close();
  cloudStore = null;
  cloudApplying = true;
  activeUserId = user?.id || null;
  activeTreeId = null;
  treeCatalog = null;
  treeList = [];
  document.getElementById("tree-select").replaceChildren();
  document.getElementById("workspace").hidden = true;
  document.getElementById("auth-screen").hidden = false;
  document.getElementById("auth-form").hidden = !!user;
  document.getElementById("auth-retry-actions").hidden = !user;
  document.getElementById("account-email").textContent = user?.email || "";
  document.getElementById("auth-message").textContent = user ? "Loading your family tree…" : "Sign in or create an account. Every account starts with an empty tree.";
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  hideUndoToast();
  hideTooltip();
  state.people = [];
  state.relationships = [];
  recycleBin = [];
  undoStack = [];
  redoStack = [];
  pendingDeletePersonId = null;
  pendingDeleteRelationshipKey = null;
  relationshipFilterPersonId = null;
  refs.personSearch.value = "";
  document.getElementById("selection-count").textContent = "0 selected";
  refs.message.textContent = "";
  refs.relationshipForm.reset();
  refs.relationshipEditorForm.reset();
  refs.relationshipsList.textContent = "";
  refs.recycleBinList.textContent = "";
  refreshGraphFromState();
  updateHistoryControls();
  if (!user) return;
  try {
    const catalog = new FamilyTreeCatalog(authClient, user.id);
    let trees = await catalog.list();
    if (generation !== sessionGeneration) return;
    if (!trees.length) {
      try { await catalog.create("My Family Tree", user.id); }
      catch (error) { if (error.code !== "23505") throw error; }
      trees = await catalog.list();
    }
    if (generation !== sessionGeneration) return;
    let remembered = null;
    try { remembered = localStorage.getItem(`family-tree-active:${user.id}`); } catch { /* Optional UI preference. */ }
    const selected = trees.find(tree => tree.id === (requestedTreeId || remembered)) || trees[0];
    if (!selected) throw new Error("Could not find a family tree. Retry loading.");
    treeCatalog = catalog;
    treeList = trees;
    activeTreeId = selected.id;
    renderTreePicker();
    const store = new FamilyTreeStore(authClient, user.id, sessionStorage, (status, detail) => {
      if (generation === sessionGeneration) reportSync(status, detail);
    }, selected.id, selected.name);
    cloudStore = store;
    const loaded = await store.load();
    if (generation !== sessionGeneration) return;
    state.people = loaded.people;
    state.relationships = loaded.relationships;
    recycleBin = loaded.recycleBin;
    normalizeState();
    document.getElementById("auth-screen").hidden = true;
    document.getElementById("workspace").hidden = false;
    refreshGraphFromState();
    cy.resize();
    cloudApplying = false;
    try { localStorage.setItem(`family-tree-active:${user.id}`, selected.id); } catch { /* Optional UI preference. */ }
    if (!store.conflict && store.pending) store.flush().catch(() => {});
  } catch (error) {
    if (generation !== sessionGeneration) return;
    document.getElementById("auth-message").textContent =
      ["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code)
        ? "Cloud storage needs setup. Run both family-tree SQL migrations in Supabase, then retry loading."
        : `Could not load your tree: ${error.message}. Your cloud data has not been replaced.`;
  }
}

function renderTreePicker() {
  const select = document.getElementById("tree-select");
  select.replaceChildren(...treeList.map(tree => {
    const option = document.createElement("option");
    option.value = tree.id;
    option.textContent = tree.name;
    return option;
  }));
  select.value = activeTreeId || "";
}

function openTreeDialog(mode) {
  if (treeChanging || !treeCatalog) return;
  treeDialogMode = mode;
  document.getElementById("tree-dialog-title").textContent = mode === "import" ? "Import Family Tree" : mode === "create" ? "New Family Tree" : "Rename Family Tree";
  document.getElementById("tree-name").value = mode === "import" ? pendingImport.name : mode === "rename" ? treeList.find(tree => tree.id === activeTreeId)?.name || "" : "";
  document.getElementById("tree-dialog-copy").hidden = mode !== "import";
  document.getElementById("tree-dialog-copy").textContent = mode === "import" ? `Import ${pendingImport.document.people.length} people into a new tree. Your existing trees will not be changed.` : "";
  document.getElementById("tree-error").textContent = "";
  document.getElementById("tree-dialog").showModal();
  document.getElementById("tree-name").focus();
}

async function changeTree(id) {
  if (treeChanging || id === activeTreeId) return;
  const userId = activeUserId;
  treeChanging = true;
  document.getElementById("workspace").inert = true;
  try {
    await cloudStore?.flush();
    const { data, error } = await authClient.auth.getSession();
    if (error) throw error;
    if (activeUserId !== userId || data.session?.user.id !== userId) return;
    await applyAccountSession(data.session, true, id);
  } catch (error) {
    reportSync(cloudStore?.conflict ? "conflict" : "error", `Tree switch paused: ${error.message}`);
    renderTreePicker();
  } finally {
    treeChanging = false;
    document.getElementById("workspace").inert = false;
  }
}

async function submitTreeForm(event) {
  event.preventDefault();
  if (treeChanging) return;
  const userId = activeUserId;
  const catalog = treeCatalog;
  const id = activeTreeId;
  const mode = treeDialogMode;
  const imported = mode === "import" ? pendingImport : null;
  const name = document.getElementById("tree-name").value;
  treeChanging = true;
  document.getElementById("workspace").inert = true;
  document.getElementById("save-tree").disabled = true;
  try {
    catalog.validateName(name);
    await cloudStore.flush();
    if (userId !== activeUserId) return;
    const result = mode === "import" ? await catalog.create(name, imported.id, imported.document)
      : mode === "create" ? await catalog.create(name) : await catalog.rename(id, name);
    if (userId !== activeUserId) return;
    if (mode === "rename") {
      treeList = treeList.map(tree => tree.id === id ? result : tree);
      cloudStore.name = result.name;
      renderTreePicker();
    }
    document.getElementById("tree-dialog").close();
    if (mode !== "rename") {
      const { data, error } = await authClient.auth.getSession();
      if (error) throw error;
      if (data.session?.user.id === userId) await applyAccountSession(data.session, true, result.id);
    }
  } catch (error) {
    document.getElementById("tree-error").textContent = error.message;
  } finally {
    treeChanging = false;
    document.getElementById("workspace").inert = false;
    document.getElementById("save-tree").disabled = false;
  }
}

async function signOutAccount() {
  try {
    await cloudStore?.flush();
    // Only revoke this app's session, not the other app's sessions in this project.
    const { error } = await authClient.auth.signOut({ scope: "local" });
    if (error) throw error;
    await applyAccountSession(null);
    document.getElementById("auth-password").value = "";
  } catch (error) {
    reportSync("error", `Sign out paused: ${error.message}`);
    document.getElementById("auth-message").textContent = error.message;
  }
}

function downloadFamilyJson(data, filename) {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function validateFamilyData(data) {
  if (!data || !Array.isArray(data.people) || !Array.isArray(data.relationships)) {
    throw new Error("Invalid family file: people and relationships must be lists.");
  }
  const ids = new Set();
  for (const person of data.people) {
    if (!person || typeof person.id !== "string" || !person.id || ids.has(person.id)
      || typeof person.name !== "string" || !person.name.trim()
      || !["male", "female"].includes(person.gender)) {
      throw new Error("Invalid person: provide a unique ID, name, and supported gender.");
    }
    ids.add(person.id);
    if (person.position && (!Number.isFinite(person.position.x) || !Number.isFinite(person.position.y))) {
      throw new Error("Invalid saved node position.");
    }
  }
  for (const relationship of data.relationships) {
    if (!relationship || typeof relationship.from !== "string" || typeof relationship.to !== "string"
      || !["parent", "child", "spouse", "sibling"].includes(relationship.type)) {
      throw new Error("Invalid relationship in family file.");
    }
  }
}
