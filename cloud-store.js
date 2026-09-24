/* Private named trees; optimistic concurrency prevents stale-tab writes. */
(function (root) {
  class FamilyTreeStore {
    constructor(client, userId, drafts, report = () => {}, treeId = userId, name = "My Family Tree") {
      this.client = client;
      this.userId = userId;
      this.drafts = drafts;
      this.report = report;
      this.treeId = treeId;
      this.name = name;
      this.key = `family-tree-draft-v2:${userId}:${treeId}`;
      this.revision = 0;
      this.pending = null;
      this.loaded = false;
      this.conflict = false;
      this.closed = false;
      this.running = null;
      this.timer = null;
      this.last = "";
    }

    async load() {
      const { data, error } = await this.client.from("family_tree_documents")
        .select("document,revision").eq("owner_id", this.userId).eq("id", this.treeId).maybeSingle();
      if (error) throw error;
      const document = data?.document || { people: [], relationships: [], recycleBin: [] };
      this.validate(document);
      this.revision = data?.revision || 0;
      this.last = JSON.stringify(document);
      let draft = null;
      try {
        draft = JSON.parse(this.drafts.getItem(this.key));
        // Migration assigns the original tree its owner's UUID, preserving old drafts.
        if (!draft && this.treeId === this.userId) {
          draft = JSON.parse(this.drafts.getItem(`family-tree-draft-v1:${this.userId}`));
          if (draft) {
            this.drafts.setItem(this.key, JSON.stringify(draft));
            this.drafts.removeItem(`family-tree-draft-v1:${this.userId}`);
          }
        }
      } catch { /* Invalid draft is not loaded. */ }
      if (draft?.document) {
        this.validate(draft.document);
        this.pending = draft.document;
        this.conflict = draft.revision !== this.revision;
      }
      this.loaded = true;
      this.report(this.conflict ? "conflict" : this.pending ? "pending" : "saved");
      return structuredClone(this.pending || document);
    }

    validate(document) {
      if (!document || !Array.isArray(document.people) || !Array.isArray(document.relationships)
        || !Array.isArray(document.recycleBin)) throw new Error("Invalid saved family document.");
    }

    queue(document) {
      if (!this.loaded || this.closed) return;
      this.validate(document);
      const serialized = JSON.stringify(document);
      if (serialized === JSON.stringify(this.pending) || (!this.pending && serialized === this.last)) return;
      this.pending = structuredClone(document);
      this.keepDraft();
      if (this.conflict) return;
      this.report("pending");
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush().catch(() => {}), 650);
    }

    keepDraft() {
      try {
        this.drafts.setItem(this.key, JSON.stringify({ revision: this.revision, document: this.pending }));
      } catch {
        this.report("error", "Browser backup unavailable. Keep this tab open until cloud saving succeeds.");
      }
    }

    async flush() {
      clearTimeout(this.timer);
      if (this.running) return this.running;
      if (this.closed || !this.pending) return;
      if (this.conflict) throw new Error("Another tab changed this tree. Export your draft, then reload the cloud copy.");
      this.running = this.writePending();
      try { await this.running; } finally { this.running = null; }
    }

    async writePending() {
      while (this.pending && !this.closed) {
        const snapshot = this.pending;
        const serialized = JSON.stringify(snapshot);
        this.report("saving");
        try {
          const row = { id: this.treeId, name: this.name, owner_id: this.userId, document: snapshot, revision: this.revision + 1 };
          const table = this.client.from("family_tree_documents");
          const query = this.revision === 0 ? table.insert(row)
            : table.update({ document: snapshot, revision: row.revision })
              .eq("owner_id", this.userId).eq("id", this.treeId).eq("revision", this.revision);
          const { data, error } = await query.select("revision").maybeSingle();
          if (error || !data) {
            if (!data && !error || error?.code === "23505") {
              this.conflict = true;
              throw new Error("Another tab changed this tree. Export your draft, then reload the cloud copy.");
            }
            throw error;
          }
          this.revision = data.revision;
          this.last = serialized;
          if (JSON.stringify(this.pending) === serialized) {
            this.pending = null;
            this.drafts.removeItem(this.key);
          } else {
            this.keepDraft();
          }
        } catch (error) {
          this.report(this.conflict ? "conflict" : "error", error.message);
          throw error;
        }
      }
      if (!this.closed) this.report("saved");
    }

    close() {
      this.closed = true;
      clearTimeout(this.timer);
    }
  }
  class FamilyTreeCatalog {
    constructor(client, userId) { this.client = client; this.userId = userId; }
    async list() {
      const trees = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await this.client.from("family_tree_documents")
          .select("id,name").eq("owner_id", this.userId).order("id").range(offset, offset + 999);
        if (error) throw error;
        trees.push(...data);
        if (data.length < 1000) return trees;
      }
    }
    async create(name, id = crypto.randomUUID(), document = { people: [], relationships: [], recycleBin: [] }) {
      name = this.validateName(name);
      const { error } = await this.client.from("family_tree_documents").insert({
        id, owner_id: this.userId, name, revision: 1,
        document
      });
      if (error) throw error;
      return { id, name };
    }
    async rename(id, name) {
      name = this.validateName(name);
      const { data, error } = await this.client.from("family_tree_documents").update({ name })
        .eq("owner_id", this.userId).eq("id", id).select("id,name").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Tree not found.");
      return data;
    }
    validateName(name) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
        throw new Error("Enter a tree name between 1 and 120 characters.");
      }
      return name.trim();
    }
  }
  root.FamilyTreeCatalog = FamilyTreeCatalog;
  root.FamilyTreeStore = FamilyTreeStore;
  if (typeof module !== "undefined") { module.exports = FamilyTreeStore; module.exports.Catalog = FamilyTreeCatalog; }
})(globalThis);
