# T05 Parent Collision Guard

## setup
- mode: parentFolder
- syncMove: on

## action
- move this note from:
  `smoke-tests/parent-folder/t05/source/t05-parent-collision-guard`
  to:
  `smoke-tests/parent-folder/t05/destination`

## expected
- notice appears about an existing file/folder.
- `smoke-tests/parent-folder/t05/source/t05-parent-collision-guard` remains at source.
- `smoke-tests/parent-folder/t05/destination/t05-parent-collision-guard` remains unchanged.