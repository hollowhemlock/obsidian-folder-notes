# Test Vaults

- `fixture`: committed baseline vault for testing.
- `sandbox`: disposable copy used for integration/smoke runs (not committed).
- Vault sync is one-way: `fixture -> sandbox`.

Prepare sandbox vault:

```powershell
npm run fn-new-sandbox
```

Refresh sandbox notes/content from fixture (preserves `sandbox/.obsidian`):

```powershell
npm run fn-refresh-sandbox
```

Generic vault sync command (full replace):

```powershell
node ./scripts/sync-vault-one-way.mjs --full test-vaults/fixture test-vaults/sandbox
```

Generic vault sync command (content-only refresh, preserve `.obsidian`):

```powershell
node ./scripts/sync-vault-one-way.mjs --content-only test-vaults/fixture test-vaults/sandbox
```

Open fixture vault in Obsidian:

```powershell
npm run fn-open-fixture
```

Open sandbox vault in Obsidian:

```powershell
npm run fn-open-sandbox
```

Generic vault opener (pass relative path):

```powershell
node ./scripts/open-vault.mjs test-vaults/sandbox
```

Build, create a new sandbox, and open sandbox in one command:

```powershell
npm run fn-open-sandbox-fresh
```

Generic copy command (explicit plugin id + target vault path):

```powershell
node ./scripts/copy-build.mjs folder-notes test-vaults/sandbox
```

Generic copy command (multiple target vault paths):

```powershell
node ./scripts/copy-build.mjs test-vaults/fixture test-vaults/sandbox
```

Workflow:
1. Build plugin (`npm run fn-build`) (this auto-copies build artifacts into `fixture`).
2. Create fresh sandbox from fixture (`npm run fn-new-sandbox`).
3. Open `test-vaults/sandbox` in Obsidian.
4. Open `start-here.md`.
5. Run one test case at a time from its folder note in `smoke-tests/`.
6. Re-run `npm run fn-refresh-sandbox` between tests if you want to keep `.obsidian` state.
7. Re-run `npm run fn-new-sandbox` for a full reset.

Notes:
- Each smoke test uses a unique note/folder combination to avoid cross-test interference.
- The moved note is the test describer note for each scenario.
- Instructions and expected results are documented in each test describer note for direct in-app use.
- `fn-refresh-sandbox` is preferred during live Hot Reload sessions because it preserves `sandbox/.obsidian` (plugin state/watchers) while updating note content.
