# Supabase setup: private family trees

Project: `wmfplutvrinleialgmyz`.

## One-time database setup

1. Open this project's **SQL Editor** in Supabase.
2. Run [`migrations/202609230001_private_family_trees.sql`](migrations/202609230001_private_family_trees.sql) once.
3. Run [`migrations/202609240001_named_family_trees.sql`](migrations/202609240001_named_family_trees.sql) once to enable multiple named trees. If you already applied the first migration, run only this new one.
4. Sign in to the family app, or press **Retry loading tree** if already signed in.

The migration creates only `public.family_tree_documents` and its owner-only policies. It does not alter existing application tables, Auth settings, or Auth triggers. If a table with this name already exists, the migration fails transactionally; inspect it rather than overwriting it.

Each tree is a separate named row containing people, relationships, node positions, and a recycle bin. Users can create any number of trees (subject to the project's storage quotas). The second migration preserves existing documents, names them **My Family Tree**, and changes the primary key from `owner_id` to a tree `id`. New accounts receive one empty **My Family Tree**. Owner-only Row Level Security remains in effect for every tree. Anonymous access has no grants or policies. No service-role key is used in the browser.

**New Tree**, **Rename**, and the tree dropdown manage your trees. Switching waits for pending saves and clears the previous tree's forms, selection, and undo history. Recovery drafts and revision checks are isolated by both owner and tree ID. The last-opened tree is remembered per account in this browser. Old unsaved drafts are recovered only into the preserved original tree. Existing app tabs should be reloaded after migration.

The supplied publishable key cannot execute migrations. Apply the SQL with the project's dashboard administrator account. Do not paste database passwords or service-role keys into this repository.

## Shared Auth settings

- Keep the existing application's **Site URL** unchanged.
- Add `https://bmthedeve.github.io/family-tree-app/` to **Authentication → URL Configuration → Redirect URLs** for email confirmations. For local testing, add `http://localhost:8000/` as well.
- Email/password uses the project's existing provider configuration. Keep email confirmation, password policy, and signup settings as appropriate for both apps.
- **Create account** uses Supabase's normal signup flow. If public signup is disabled, create users through your existing administrator workflow and have them use **Sign in**.
- The user directory is shared: an existing account can sign into this app using the same email/password, but gets only its own family document. Changes to a shared account's password affect its login to both apps.
- Existing `auth.users` triggers also run for new signups. Review those triggers before enabling signup for family users; this app deliberately adds no Auth triggers.
- Review the other application's authorization if it currently lets *every* authenticated user access its data. Family-tree RLS protects the new table; it cannot add isolation to pre-existing tables.
- The family app uses its own browser auth storage key and local-scope sign-out, avoiding a global logout of other sessions.

## Verify after migration

1. Sign in as account A: confirm the canvas is empty, add a person, wait for **Saved to cloud**, then reload.
2. Sign out and sign in as account B: confirm A's tree and recycle bin are absent. Add B's tree and reload.
3. Use each account's authenticated API session to verify a SELECT of the other owner's row returns no rows and INSERT/UPDATE for the other owner is denied or affects no rows. Test anonymously as well. Do not use the SQL Editor's privileged role for this check.
4. Open A in two tabs, edit and save in one, then edit in the stale tab: the app must report a conflict rather than overwrite the first tab.

## Saving and recovery

Changes autosave after a short delay. Saves include the recycle bin, and writes compare the current revision to prevent stale-tab overwrites. A save failure displays **Retry save**; going online retries as well. Sign-out waits for pending saves and stays signed in if saving fails.

Unsaved drafts are stored per account in that tab's `sessionStorage`, surviving reloads in the same tab. They are not a substitute for a backup: closing the tab can discard them. Export a family file before discarding a conflicting draft or closing a tab with unsaved work. A failed initial cloud load never creates or overwrites an empty cloud tree.

Old shared `localStorage` family data is left untouched and is never assigned to an account automatically. **Download previous browser tree** on the sign-in screen exports it; sign in to the intended account and use **Import Family File** to upload it explicitly. Imports replace that account's current tree and can be undone during the session.

History is session-only. Sign-out clears the displayed tree, forms, dialogs, and undo/redo stacks. There is no live collaboration or automatic merging; reload to fetch changes from another device.

## Local verification

```sh
node --test tests/cloud-store.test.cjs
node --check script.js
```

Unit tests simulate the data API to check isolation in client requests, draft recovery, write conflicts, and failed-load behavior. They do not replace the two-account RLS check against the deployed database above.
