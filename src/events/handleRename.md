# handleRename — Move Logic

## What This Doc Covers

This file documents how Folder Notes reacts to Obsidian `rename` events, including both:
- **Move events** (parent path changed)
- **Rename events** (same parent, name changed)

It combines two entry sources:
- **GUI path**: user drags a file or folder in File Explorer (Obsidian moves first)
- **Plugin command path**: plugin command `move-folder-note-and-folder` (plugin validates and moves first)

## Quick Summary

- There are two move strategies:
  - **Reactive (GUI drag/drop)**: Obsidian performs the move, then plugin validates and may revert.
  - **Proactive (plugin command)**: plugin validates destination first, then performs move(s).
- `handleRename` is the central dispatcher for both file and folder rename/move events.
- The plugin includes multiple reentrancy guards because its own `renameFile(...)` calls emit additional rename events.
- For non-folder-note files, the plugin command falls back to Obsidian’s native move UI (`app:move-file` / `file-explorer:move-file`, then `promptForFileRename` as last resort).

## Obsidian API Reference

| API | Description | Docs |
|---|---|---|
| [`FileManager.renameFile`](https://docs.obsidian.md/Reference/TypeScript+API/FileManager/renameFile) | Move or rename a file and update all links | [docs](https://docs.obsidian.md/Reference/TypeScript+API/FileManager/renameFile) |
| [`Vault.getAbstractFileByPath`](https://docs.obsidian.md/Reference/TypeScript+API/Vault/getAbstractFileByPath) | Retrieve a file or folder by vault-absolute path | [docs](https://docs.obsidian.md/Reference/TypeScript+API/Vault/getAbstractFileByPath) |
| [`Workspace.getActiveFile`](https://docs.obsidian.md/Reference/TypeScript+API/Workspace/getActiveFile) | Get the file for the currently active view | [docs](https://docs.obsidian.md/Reference/TypeScript+API/Workspace/getActiveFile) |
| `FileManager.promptForFileRename` | Open native rename/move dialog | *undocumented internal API* |
| `App.commands.executeCommandById` | Execute a command by ID | *undocumented internal API* |

Two independent flows handle file/folder moves. They never intersect in their core logic.

## Entry Points

| Entry | Trigger | Strategy |
|---|---|---|
| **GUI path** | User drags **file or folder** in file explorer | **Reactive** — Obsidian moves the item first, plugin validates after and reverts or follows |
| **Plugin command path** | `move-folder-note-and-folder` plugin command | **Proactive** — plugin validates first, then moves. `handleRename` fires but skips at line 193 |

## Plugin vs Core Command Mapping

The Folder Notes plugin command is:
- ID: `move-folder-note-and-folder`
- Name: **Folder notes: Move folder note and folder** (command palette prefix + command name)

When the active file is **not** a folder note, the plugin command intentionally falls back to Obsidian core move UX:
- `Move current file to another folder` (Obsidian core command wording)
- `app:move-file` (internal command ID used by this plugin)
- `file-explorer:move-file`
- `FileManager.promptForFileRename` (internal fallback)

## Temporal Comparison (color-matched by phase)

**Legend:** :green_square: Trigger | :orange_square: Destination | :blue_square: Identify | :purple_square: Settings | :red_square: Validate | :cyan_square: Move Folder | :brown_square: Move Note | :grey_square: Rollback

```mermaid
graph LR
    subgraph Command ["Plugin Command Path"]
        direction TB
        H1["1. User runs plugin command"]:::trigger
        H2["2. Is file a folder note?"]:::identify
        H3["3. Check storageLocation"]:::settings
        H4["4. User picks destination via modal"]:::destination
        H5["5. Validate: self-move"]:::validate
        H6["6. Validate: folder collision"]:::validate
        H7["7. Validate: note collision\nparentFolder only"]:::validate
        H8["8. Move folder"]:::execFolder
        H9["9. Move note\nparentFolder only"]:::execNote
        H10["10. Rollback: move folder back\nif 9 fails"]:::rollback
        H1 --> H2 --> H3 --> H4 --> H5 --> H6 --> H7 --> H8 --> H9 --> H10
    end

    subgraph GUI ["GUI Path"]
        direction TB
        G1["1. User drags file or folder"]:::trigger
        G2["2. Obsidian moves item on disk"]:::destination
        G3["3. Rename event fires"]:::identify
        G4["4. Identify type + folder note status"]:::identify
        G5["5. Check syncMove + storageLocation"]:::settings
        G6["6. Validate: self-move\nrevert if fail"]:::validate
        G7["7. Validate: folder collision\nrevert if fail"]:::validate
        G8["8. Validate: note collision\ninsideFolder only, revert if fail"]:::validate
        G9["9. Move folder to follow note"]:::execFolder
        G10["10. Move note back inside\ninsideFolder only"]:::execNote
        G11["11. Rollback: move folder back\nif 10 fails"]:::rollback
        G1 --> G2 --> G3 --> G4 --> G5 --> G6 --> G7 --> G8 --> G9 --> G10 --> G11
    end

    Command ~~~ GUI

    classDef trigger fill:#4CAF50,color:#fff
    classDef destination fill:#FF9800,color:#fff
    classDef identify fill:#2196F3,color:#fff
    classDef settings fill:#9C27B0,color:#fff
    classDef validate fill:#F44336,color:#fff
    classDef execFolder fill:#00BCD4,color:#fff
    classDef execNote fill:#795548,color:#fff
    classDef rollback fill:#607D8B,color:#fff
```

The inversion is visible by color — orange (destination) is step 4 in plugin command flow but step 2 in GUI.
Red (validation) is steps 5-7 in plugin command flow (pre-move) but 6-8 in GUI (post-move with reverts).

## Plugin Command Path — Decision Tree (Commands.ts)

```mermaid
graph TD
    subgraph command ["Plugin command: move-folder-note-and-folder"]
        HK_START([Plugin command fired]) --> HK_FILE{Active file is<br>a folder note}
        HK_FILE -->|no| HK_FALLBACK["Run Obsidian core command (`Move current file to another folder`)<br>becomes GUI path"]
        HK_FILE -->|yes| HK_STORE{storageLocation}
        HK_STORE -->|vaultFolder| HK_UNSUP["Notice: not supported"]
        HK_STORE -->|insideFolder or parentFolder| HK_VAL{Pre-validate}

        HK_VAL -->|into self or descendant| HK_SELF["Notice: cannot move into itself"]
        HK_VAL -->|folder collision| HK_COLL["Notice: already exists"]
        HK_VAL -->|parentFolder note collision| HK_NCOLL["Notice: file already exists"]
        HK_VAL -->|clean| HK_EXEC{storageLocation}

        HK_EXEC -->|insideFolder| HK_INF["API: move folder<br>note travels inside"]
        HK_EXEC -->|parentFolder| HK_PAR["API: move folder<br>then move note"]
        HK_PAR -->|note move fails| HK_ROLL["API: move folder back<br>Notice: reverted"]

        HK_INF --> HK_GUARD["handleRename fires<br>but skips at line 193"]
        HK_PAR --> HK_GUARD
    end
```

## GUI Path — Decision Tree (handleRename.ts)

```mermaid
graph TD
    subgraph gui ["GUI: file or folder dragged in explorer"]
        DRAG([User drags file or folder in file explorer])
        DRAG --> CORE["Obsidian core: item moved on disk"]
        CORE --> START(["Obsidian fires rename event"])
        START --> TYPE{What moved}

        TYPE -->|TFolder| F_STORE{storageLocation}
        TYPE -->|TFile was folder note| N_SYNC{syncMove}
        TYPE -->|TFile not folder note| R_DEST{Name matches<br>folder at dest}

        F_STORE -->|insideFolder| F1a["No-op<br>note already moved with folder"]
        F_STORE -->|parentFolder or vaultFolder| F_SYNC{syncMove}
        F_SYNC -->|false| F1b["No-op<br>note left behind at old path"]
        F_SYNC -->|true| F_NOTE{Has folder note}
        F_NOTE -->|no| F1c["No-op"]
        F_NOTE -->|yes| F1d["API: move note to new parent"]

        N_SYNC -->|false| N2a["Cleanup CSS<br>note stays where Obsidian put it"]
        N_SYNC -->|true| N_STORE{storageLocation}
        N_STORE -->|vaultFolder| N2b["No-op<br>note stays where Obsidian put it"]
        N_STORE -->|insideFolder| N_IN{Destination}
        N_STORE -->|parentFolder| N_PAR{Destination}

        N_IN -->|into self or descendant| N2c["API: move note back to old path<br>Notice"]
        N_IN -->|folder collision| N2d["API: move note back to old path<br>Notice"]
        N_IN -->|note collision| N2e["API: move note back to old path<br>Notice"]
        N_IN -->|clean| N2f["API: move folder to follow note<br>then move note back inside folder"]
        N2f -->|restore fails| N2f_R["API: move folder back to old path"]

        N_PAR -->|into self or descendant| N2g["API: move note back to old path<br>Notice"]
        N_PAR -->|folder collision| N2h["API: move note back to old path<br>Notice"]
        N_PAR -->|clean| N2i["API: move folder to follow note<br>note already at destination"]

        R_DEST -->|yes with existing note| R3a["API: move file back to old path"]
        R_DEST -->|yes no existing note| R_EXCL{Folder excluded}
        R_DEST -->|no match| R3f["No-op<br>regular file, nothing to sync"]
        R_EXCL -->|disableFolderNote| R3e["No-op"]
        R_EXCL -->|not excluded| R3b["Mark as folder note via CSS"]
    end
```

## GUI Path — All Code Paths by State

### State 1: Folder Moved

| # | storageLocation | syncMove | Has folder note? | Outcome |
|---|---|---|---|---|
| 1a | `insideFolder` | any | any | **No-op** — note is inside the folder, moves automatically |
| 1b | `parentFolder` | `false` | any | **No-op** |
| 1c | `parentFolder` | `true` | no | **No-op** |
| 1d | `parentFolder` | `true` | yes | **Move note** to folder's new parent directory |
| 1e | `vaultFolder` | `false` | any | **No-op** |
| 1f | `vaultFolder` | `true` | no | **No-op** |
| 1g | `vaultFolder` | `true` | yes | **Move note** to folder's new parent directory |

### State 2: Folder-Note File Moved Away

| # | storageLocation | syncMove | Destination condition | Outcome |
|---|---|---|---|---|
| 2a | any | `false` | any | **Cleanup** CSS classes only |
| 2b | `vaultFolder` | `true` | any | **No-op** — no stable parent semantics |
| 2c | `insideFolder` | `true` | Target is source folder or descendant | **Revert** + Notice |
| 2d | `insideFolder` | `true` | Folder name collision at destination | **Revert** + Notice |
| 2e | `insideFolder` | `true` | Note name collision inside target folder | **Revert** + Notice |
| 2f | `insideFolder` | `true` | Clean destination | **Move folder** + **restore note inside** (two-step with rollback) |
| 2g | `parentFolder` | `true` | Target is source folder or descendant | **Revert** + Notice |
| 2h | `parentFolder` | `true` | Folder name collision at destination | **Revert** + Notice |
| 2i | `parentFolder` | `true` | Clean destination | **Move folder** to follow note |

`insideFolder` has an extra validation (2e — note collision) and a two-step move (2f) vs. `parentFolder`'s single-step (2i).

### State 3: Non-Folder-Note File Moved

| # | storageLocation | Destination condition | Outcome |
|---|---|---|---|
| 3a | any | Name matches a folder that already has a folder note | **Revert** move to old path |
| 3b | any | Name matches folder, no existing note, not excluded | **Mark as folder note** via CSS |
| 3e | any | Folder has `disableFolderNote` exclusion | **No-op** |
| 3f | any | Name doesn't match any folder at destination | **No-op** |

## Summary

| Initial state | Paths |
|---|---|
| Folder | 7 (1a-1g) |
| Folder-note file | 9 (2a-2i) |
| Regular file | 4 (3a, 3b, 3e, 3f) |
| **GUI total** | **20** |
| **Plugin command total** | **7** (fallback, unsupported, 3 validations, 2 executions) |

## Plugin Command vs GUI Comparison

| | GUI (drag in explorer) | Plugin command |
|---|---|---|
| **When validation happens** | After Obsidian moved the file — plugin must revert on error | Before any file moves — rejects early with a Notice |
| **Who moves what first** | User moves the note, plugin moves the folder to follow | Plugin moves the folder first, then moves the note |
| **Rollback mechanism** | `revertMovedFolderNote` renames note back | Catches `renameFile` failure, renames folder back |
| **handleRename interaction** | Full decision tree runs | Sets `isRunningMoveFolderWithNoteCommand = true`, skips at line 193 |
| **Non-folder-note files** | Falls through to State 3 | Falls back to native `Move current file to another folder` dialog (becomes GUI path) |
| **vaultFolder support** | State 2 silently no-ops | Explicitly blocked with Notice |
| **insideFolder move** | Two-step: move folder, restore note inside (with rollback) | Single-step: move folder, note is already inside |
| **parentFolder move** | Single-step: move folder to follow note (note already at dest) | Two-step: move folder, then move note (with rollback) |

## Reentrancy Guards

The plugin's own `renameFile` calls trigger new Obsidian rename events. Without protection, this creates infinite loops. Three mechanisms prevent this:

### `withMoveGuard` (line 51)

Wraps a critical section. Any paths added to `guardedFolderPaths` or `guardedFilePaths` cause `handleFileMove` to bail at line 202 via `isGuardedMovePath`. Folder guards also cover all descendant paths (`path.startsWith(folderPath/)`). Guards are removed in a `finally` block so they clean up even on error.

Used by:
- `handleFileMove` State 2f/2i (line 272) — guards both the source and destination folder/file paths during folder-follows-note moves
- `revertMovedFolderNote` (line 95) — guards both old and new path during revert

### `suppressedFileMoveEvents` (line 23)

A one-shot suppression keyed on `fromPath=>toPath`. When the plugin is about to trigger a rename that would re-enter `handleFileMove`, it registers the exact expected event key. `consumeSuppressedFileMoveEvent` (line 29) checks and deletes the key, returning `true` once. This is more targeted than `withMoveGuard` — it suppresses exactly one specific event.

Used by:
- `revertMovedFolderNote` (line 94) — suppresses the revert rename event so it doesn't re-enter move logic

### `isRunningMoveFolderWithNoteCommand` (line 193)

A boolean flag on the plugin instance. Set to `true` by the plugin command in `Commands.ts` (line 413), cleared in a `finally` block (line 433). Causes `handleFileMove` to return immediately. This is the simplest guard — a whole-function bypass for the duration of the plugin command.

## Rename Handling

`handleRename` dispatches renames (same parent, different name) separately from moves. This is the other half of the dispatch at lines 133-144.

### Folder Rename (`handleFolderRename`, line 374)

When a folder is renamed, the folder note's filename must sync to match.

| # | storageLocation | syncFolderName | Has folder note | Outcome | Line |
|---|---|---|---|---|---|
| R1 | any | any | no | **No-op** | 384 |
| R2 | any | any | yes, excluded with `disableSync` | **Unreachable with current guard** (`folderNote` is guaranteed before this branch) | 388 |
| R3 | any | `false` | yes | **No-op** | 392 |
| R4 | `parentFolder` | `true` | yes, parent also changed | **No-op** if `!syncMove`, else rename note at new parent | 398 |
| R5 | `parentFolder` | `true` | yes, same parent | **Rename note** to match new folder name | 405 |
| R6 | `insideFolder` | `true` | yes | **Rename note** inside folder to match new folder name | 409 |

### File Rename (`handleFileRename`, line 416)

When a file is renamed, it may become or stop being a folder note.

| # | Condition | syncFolderName | Outcome | Line |
|---|---|---|---|---|
| FR1 | New name matches a folder, not excluded, not detached | any | **Mark as folder note** via CSS | 436 |
| FR2 | Name no longer matches any folder | any | **Remove** folder note CSS classes | 444 |
| FR3 | Excluded with `disableSync` or `syncFolderName=false` | n/a | **No-op** (early return) | 449 |
| FR4 | New name matches same folder it was already in | `true` | **Update CSS** — re-mark file and folder | 454 |
| FR5 | Was a folder note, renamed — folder should follow | `true` | **Rename folder** to match new note name | 460 |
| FR5a | ...but a folder with that name already exists | `true` | **Revert** file rename + Notice | 498 |

## CSS Class Lifecycle (`only-has-folder-note`)

Lines 113-127 run on **every** rename event, before the move/rename dispatch. They maintain the `only-has-folder-note` CSS class on both the new and old parent folders:

```
if folder is empty (only has its folder note) AND has a folder note:
    add 'only-has-folder-note'
else:
    remove 'only-has-folder-note'
```

This check uses `plugin.isEmptyFolderNoteFolder()` and runs for both `file.parent` (new location) and the old folder (resolved from `oldPath`). It ensures the class updates immediately when files move in or out of a folder.

## Excluded Folder Path Updates (`updateExcludedFolderPath`, line 506)

Runs on every folder rename/move event (line 132), before the rename/move dispatch. When a folder's path changes, any exclusion rules targeting that folder become stale. This function:

1. Finds all excluded folder entries whose `path` includes the old path (line 511)
2. For exact matches: replaces the path directly (line 517)
3. For nested matches: splits on `/`, replaces the matching segment, rejoins (line 521-527)
4. Saves settings (line 529)

This runs regardless of `syncMove` or `syncFolderName` — exclusion rules always track folder paths.

## Source Line Reference

| Path ID | Function | Line |
|---|---|---|
| 1a-1g | `handleFolderMove` | 169 |
| 2a | `handleFileMove` — `cleanupMovedFolderNote` | 224 |
| 2b | `handleFileMove` — vaultFolder early return | 229 |
| 2c-2e | `handleFileMove` — `revertMovedFolderNote` | 240, 249, 259 |
| 2f | `handleFileMove` — `withMoveGuard` + two-step move | 272 |
| 2g-2h | `handleFileMove` — `revertMovedFolderNote` | 240, 249 |
| 2i | `handleFileMove` — `withMoveGuard` + single move | 272 |
| 3a | `handleFileMove` — `renameExistingFolderNote` | 218 |
| 3b | `handleFileMove` — `markFileAsFolderNote` | 296 |
| 3e | `handleFileMove` — excluded early return | 295 |
| 3f | `handleFileMove` — implicit fall-through | 308 |
| R1-R6 | `handleFolderRename` | 374 |
| FR1-FR5 | `handleFileRename` | 416 |

## Known Edge Cases

### 1g: `vaultFolder` folder move uses wrong destination

`handleFolderMove` (line 181) computes `newFolder.parent?.path / folderNote.name` for the note's new path. For `parentFolder` this is correct — the note should sit next to the folder. But for `vaultFolder` the note should stay in the configured vault folder, not move to the folder's new parent. This path moves the note **out of** the vault folder.

### 3a: `renameExistingFolderNote` temporarily modifies exclusion rules

When a file is moved into a folder where it would become a folder note but one already exists (line 339), the plugin reverts the move via `renameFile(file, oldPath)`. But this revert would itself trigger sync logic (renaming the folder to match). To prevent this, `renameExistingFolderNote`:

1. If no exclusion exists for the folder: **creates a temporary one** (`addExcludedFolder`, line 355)
2. If one exists but `disableSync` is false: **temporarily sets `disableSync = true`** (line 358)
3. Calls `renameFile` to revert
4. In the `.then()` callback: **removes the temporary exclusion** or **restores `disableSync`** (lines 363-368)

This is a workaround to suppress rename-sync during revert without using the guard mechanism.

### Rename handlers don't use reentrancy guards

`handleFolderRename` (line 412) and `renameFolderOnFileRename` (line 503) call `renameFile` without `withMoveGuard`. Their rename events will re-enter `handleRename`, relying on the new name/path being correct to exit early (e.g., `fileName === oldFileName` at line 381). The `renameExistingFolderNote` workaround above is evidence this implicit approach requires special handling.
