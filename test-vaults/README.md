# Test Vaults

- `fixture`: committed baseline vault for testing.
- `sandbox`: disposable copy used for integration/smoke runs (not committed).

Prepare sandbox vault:

```powershell
npm run fn-prepare-sandbox
```

Refresh sandbox notes/content from fixture (preserves `sandbox/.obsidian`):

```powershell
npm run fn-refresh-sandbox-content
```

Open fixture vault in Obsidian:

```powershell
npm run fn-open-fixture
```

Open sandbox vault in Obsidian:

```powershell
npm run fn-open-sandbox
```

Build, refresh sandbox, and open sandbox in one command:

```powershell
npm run fn-open-sandbox-fresh
```

Copy current build to fixture vault plugin folder:

```powershell
npm run fn-copy-build-to-fixture
```

Copy current build directly to sandbox vault plugin folder:

```powershell
npm run fn-copy-build-to-sandbox
```

Workflow:
1. Build plugin (`npm run fn-build`) (this auto-copies build artifacts into `fixture`).
2. Create fresh sandbox from fixture (`npm run fn-prepare-sandbox`).
3. Open `test-vaults/sandbox` in Obsidian.
4. Open `start-here.md`.
5. Run one test case at a time from its folder note in `SmokeTests/`.
6. Re-run `npm run fn-refresh-sandbox-content` between tests if you want to keep `.obsidian` state.
7. Re-run `npm run fn-prepare-sandbox` for a full reset.

Notes:
- Each smoke test uses a unique note/folder combination to avoid cross-test interference.
- The moved note is the test describer note for each scenario.
- Instructions and expected results are documented in each test describer note for direct in-app use.
- `fn-refresh-sandbox-content` is preferred during live Hot Reload sessions because it preserves `sandbox/.obsidian` (plugin state/watchers) while updating note content.
