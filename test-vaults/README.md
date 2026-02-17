# Test Vaults

- `fixture`: committed baseline vault for testing.
- `sandbox`: disposable copy used for integration/smoke runs (not committed).

Prepare sandbox vault:

```powershell
npm run fn-gen-test-vault
```

Copy current build to fixture vault plugin folder:

```powershell
npm run fn-copy-build-to-fixture
```

Workflow:
1. Build plugin (`npm run fn-build`) (this auto-copies build artifacts into `fixture`).
2. Create fresh sandbox from fixture (`npm run fn-gen-test-vault`).
3. Open `test-vaults/sandbox` in Obsidian.
4. Open `start-here.md`.
5. Run one test case at a time from its folder note in `SmokeTests/`.
6. Re-run `npm run fn-gen-test-vault` before each additional test to reset state.

Notes:
- Each smoke test uses a unique note/folder combination to avoid cross-test interference.
- The moved note is the test describer note for each scenario.
- Instructions and expected results are documented in each test describer note for direct in-app use.
