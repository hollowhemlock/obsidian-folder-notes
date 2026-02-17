# T06 Sync Off Behavior

## setup
- mode: parentFolder
- syncMove: off

## action
- move this note ([[smoke-tests/parent-folder/t06/source/t06-sync-off-behavior]]) to [[smoke-tests/parent-folder/t06/destination]].

## expected
- [[smoke-tests/parent-folder/t06/destination/t06-sync-off-behavior]] exists as moved note.
- [[smoke-tests/parent-folder/t06/source/t06-sync-off-behavior]] (folder) stays in place.
- folder-note association is removed (baseline unmark behavior).