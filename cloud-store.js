/* One private document per account; optimistic concurrency prevents stale-tab writes. */
(function (root) {
  class FamilyTreeStore {
    constructor(client, userId, drafts, report = () => {}) {
      this.client = client;
      this.userId = userId;
      this.drafts = drafts;
      this.report = report;
      this.key = `family-tree-draft-v1:${userId}`;
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
        .select("document,revision").eq("owner_id", this.userId).maybeSingle();
      if (error) throw error;
      const document = data?.document || { people: [], relationships: [], recycleBin: [] };
      this.validate(document);
      this.revision = data?.revision || 0;
      this.last = JSON.stringify(document);
      let draft = null;
      try { draft = JSON.parse(this.drafts.getItem(this.key)); } catch { /* Invalid draft is not loaded. */ }
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
          const row = { owner_id: this.userId, document: snapshot, revision: this.revision + 1 };
          const table = this.client.from("family_tree_documents");
          const query = this.revision === 0 ? table.insert(row)
            : table.update({ document: snapshot, revision: row.revision })
              .eq("owner_id", this.userId).eq("revision", this.revision);
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
  root.FamilyTreeStore = FamilyTreeStore;
  if (typeof module !== "undefined") module.exports = FamilyTreeStore;
})(globalThis);
