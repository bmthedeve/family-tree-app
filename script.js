const STORAGE_KEY = "family-tree-app-data-v1";
const SIDEBAR_WIDTH_KEY = "family-tree-sidebar-width-v1";
const SIDEBAR_COLLAPSED_KEY = "family-tree-sidebar-collapsed-v1";
const RECYCLE_BIN_KEY = "family-tree-recycle-bin-v1";
const HISTORY_LIMIT = 50;

const sampleData = {
  people: [
    { id: "p1", name: "Arun", gender: "male", dateOfBirth: "1956-05-12" },
    { id: "p2", name: "Meera", gender: "female", dateOfBirth: "1958-11-04" },
    { id: "p3", name: "Bala", gender: "male", dateOfBirth: "1982-03-18" },
    { id: "p4", name: "Latha", gender: "female", dateOfBirth: "1986-07-23" },
    { id: "p5", name: "Sanjay", gender: "male", dateOfBirth: "1960-09-14" },
    { id: "p6", name: "Kala", gender: "female", dateOfBirth: "1962-02-01" },
    { id: "p7", name: "Divya", gender: "female", dateOfBirth: "1985-01-11" },
    { id: "p8", name: "Nikhil", gender: "male", dateOfBirth: "1988-04-29" },
    { id: "p9", name: "Isha", gender: "female", dateOfBirth: "2010-06-15" },
    { id: "p10", name: "Rohan", gender: "male", dateOfBirth: "2012-09-03" }
  ],
  relationships: [
    { from: "p1", to: "p3", type: "parent" },
    { from: "p2", to: "p3", type: "parent" },
    { from: "p1", to: "p4", type: "parent" },
    { from: "p2", to: "p4", type: "parent" },
    { from: "p5", to: "p7", type: "parent" },
    { from: "p6", to: "p7", type: "parent" },
    { from: "p5", to: "p8", type: "parent" },
    { from: "p6", to: "p8", type: "parent" },
    { from: "p3", to: "p4", type: "sibling" },
    { from: "p4", to: "p3", type: "sibling" },
    { from: "p7", to: "p8", type: "sibling" },
    { from: "p8", to: "p7", type: "sibling" },
    { from: "p3", to: "p7", type: "spouse" },
    { from: "p7", to: "p3", type: "spouse" },
    { from: "p4", to: "p8", type: "spouse" },
    { from: "p8", to: "p4", type: "spouse" },
    { from: "p3", to: "p9", type: "parent" },
    { from: "p7", to: "p9", type: "parent" },
    { from: "p4", to: "p10", type: "parent" },
    { from: "p8", to: "p10", type: "parent" }
  ]
};

const state = loadState();
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
let multiDragState = null;
let recycleBin = loadRecycleBin();
let undoStack = [];
let redoStack = [];
let pendingDeletePersonId = null;
let pendingDeleteRelationshipKey = null;
let relationshipFilterPersonId = null;
let toastTimer = null;

initialize();

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

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return structuredClone(sampleData);
  }

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.warn("Falling back to sample data after JSON parse failure.", error);
    return structuredClone(sampleData);
  }
}

function loadRecycleBin() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECYCLE_BIN_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.warn("Ignoring invalid recycle bin data.", error);
    return [];
  }
}

function normalizeState() {
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
    userPanningEnabled: true,
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
        "background-color": "data(color)",
        "border-width": 2,
        "border-color": "#ffffff",
        "overlay-padding": 8,
        "overlay-opacity": 0
      }
    },
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
    }
  ];
}

function buildElements() {
  const nodes = state.people.map((person) => ({
    data: {
      id: person.id,
      label: person.name,
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

  cy.on("tap", "node", (event) => {
    const node = event.target;
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

  cy.on("dragfree", "node", () => saveNodePositions());
  cy.on("grab", "node", handleNodeGrab);
  cy.on("drag", "node", handleNodeDrag);
  cy.on("free", "node", handleNodeFree);
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
    dateOfDeath: String(form.get("dod") || document.getElementById("dod").value || "")
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
    event.currentTarget.reset();
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
  state.people.push(person);
  cy.add({
    group: "nodes",
    data: {
      id: person.id,
      label: person.name,
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
      label: updatedPerson.name,
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
    showUndoToast("Relationship updated.");
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

  layout.run();

  if (layoutName !== "preset") {
    cy.once("layoutstop", () => {
      saveState();
      if (fitView) {
        cy.fit(undefined, getFitPadding());
      }
    });
  }

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
  link.download = "family-graph.familygraph.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importFamilyFile(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const importedData =
        parsed && Array.isArray(parsed.people) && Array.isArray(parsed.relationships)
          ? parsed
          : parsed?.data;

      if (!importedData || !Array.isArray(importedData.people) || !Array.isArray(importedData.relationships)) {
        throw new Error("Invalid family graph file.");
      }

      loadImportedState(importedData);
      showMessage(`Imported ${importedData.people.length} people from ${file.name}.`);
    } catch (error) {
      showMessage(error.message || "Failed to import family graph file.", true);
    } finally {
      refs.importDataInput.value = "";
    }
  };

  reader.readAsText(file);
}

function loadImportedState(importedData) {
  recordHistory("Import family file");
  state.people = structuredClone(importedData.people);
  state.relationships = structuredClone(importedData.relationships);

  normalizeState();
  cy.elements().remove();
  cy.add(buildElements());
  populatePersonSelects();
  refreshStats();
  renderPeopleTable();
  resetPersonForm();
  clearHighlight();

  const hasSavedPositions = state.people.some((person) => person.position);
  if (hasSavedPositions) {
    runLayout(true, false);
  } else {
    runLayout(true, true);
  }

  saveState();
}

function showTooltip(node, renderedPosition) {
  const person = findPerson(node.id());
  if (!person) {
    return;
  }

  refs.tooltip.innerHTML = `
    <strong>${escapeHtml(person.name)}</strong>
    <div>DOB: ${formatDate(person.dateOfBirth)}</div>
    <div>DOD: ${person.dateOfDeath ? formatDate(person.dateOfDeath) : "N/A"}</div>
  `;
  refs.tooltip.classList.remove("hidden");
  refs.tooltip.style.left = `${renderedPosition.x + 22}px`;
  refs.tooltip.style.top = `${renderedPosition.y + 18}px`;
}

function hideTooltip() {
  refs.tooltip.classList.add("hidden");
}

function populatePersonSelects() {
  const options = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`)
    .join("");

  refs.personA.innerHTML = options;
  refs.personB.innerHTML = options;
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
  refs.sidebarToggleButton.title = `${action} sidebar`;
}

function handleWindowResize() {
  if (!cy) {
    return;
  }

  cy.resize();
  cy.fit(undefined, getFitPadding());
}

function handleNodeGrab(event) {
  const grabbedNode = event.target;

  if (!grabbedNode.selected()) {
    cy.nodes(":selected").unselect();
    grabbedNode.select();
  }

  const selectedNodes = cy.nodes(":selected");
  if (selectedNodes.length <= 1) {
    multiDragState = null;
    return;
  }

  multiDragState = {
    leadId: grabbedNode.id(),
    lastPosition: { ...grabbedNode.position() },
    followerIds: selectedNodes
      .not(grabbedNode)
      .map((node) => node.id())
  };
}

function handleNodeDrag(event) {
  if (!multiDragState || event.target.id() !== multiDragState.leadId) {
    return;
  }

  const currentPosition = event.target.position();
  const dx = currentPosition.x - multiDragState.lastPosition.x;
  const dy = currentPosition.y - multiDragState.lastPosition.y;

  if (dx === 0 && dy === 0) {
    return;
  }

  cy.batch(() => {
    multiDragState.followerIds.forEach((nodeId) => {
      const node = cy.getElementById(nodeId);
      if (!node.nonempty()) {
        return;
      }

      const position = node.position();
      node.position({
        x: position.x + dx,
        y: position.y + dy
      });
    });
  });

  multiDragState.lastPosition = { ...currentPosition };
}

function handleNodeFree() {
  if (!multiDragState) {
    return;
  }

  multiDragState = null;
  saveState();
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

  editingPersonId = personId;
  document.getElementById("name").value = person.name;
  document.getElementById("gender").value = person.gender;
  document.getElementById("dob").value = person.dateOfBirth || "";
  document.getElementById("dod").value = person.dateOfDeath || "";
  refs.personSubmit.textContent = "Save Changes";
  refs.personCancel.classList.remove("hidden-button");
  refs.personForm.scrollIntoView({ behavior: "smooth", block: "start" });
  showMessage(`Editing ${person.name}.`);
}

function resetPersonForm() {
  editingPersonId = null;
  refs.personForm.reset();
  document.getElementById("gender").value = "male";
  refs.personSubmit.textContent = "Add Person";
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
  localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(recycleBin));
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
  showUndoToast(`${entry.person.name}: action completed.`);
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
    ? matches.map((person) => `<button type="button" class="search-result" role="option" data-person-id="${escapeHtml(person.id)}">${escapeHtml(person.name)}</button>`).join("")
    : '<p class="search-empty">No matching people.</p>';
}

function handleSearchResultClick(event) {
  const button = event.target.closest("button[data-person-id]");
  if (!button) {
    return;
  }
  jumpToPerson(button.dataset.personId);
}

function jumpToPerson(personId) {
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
  showMessage(`Centered on ${nameForId(personId)}.`);
}

function handleHistoryShortcut(event) {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) {
    return;
  }
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
