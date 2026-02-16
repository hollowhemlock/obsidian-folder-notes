# Test Vaults

- `fixture`: committed baseline vault for testing.
- `sandbox`: disposable copy used for integration/smoke runs (not committed).

Prepare sandbox vault:

```powershell
npm run test-vault
```

Copy current build to fixture vault plugin folder:

```powershell
npm run test-vault:copy-build
```

Workflow:
1. Build plugin (`npm run fn-build`) (this now auto-copies build artifacts into `fixture`).
2. Create fresh sandbox from fixture (`npm run test-vault:prepare-sandbox`).
3. Open `test-vaults/sandbox` in Obsidian.
4. Enable `syncMove`.
5. insideFolder scenario:
   - Set storage location to `insideFolder`.
   - Move `BySetting/insideFolder/Alpha/Alpha.md` to `Inbox`.
6. Re-run `npm run test-vault:prepare-sandbox` to reset sandbox.
7. parentFolder scenario:
   - Set storage location to `parentFolder`.
   - Move `BySetting/parentFolder/Beta.md` to `Inbox`.
