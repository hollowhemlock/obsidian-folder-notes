import {
	TFolder,
	Notice,
	TFile,
	Platform,
	FuzzySuggestModal,
	type App,
	type Menu,
	type TAbstractFile,
	type Editor,
	type MarkdownView,
} from 'obsidian';
import type FolderNotesPlugin from './main';
import {
	getFolderNote,
	createFolderNote,
	deleteFolderNote,
	turnIntoFolderNote,
	openFolderNote,
	extractFolderName,
	detachFolderNote,
	getFolderNoteFolder,
} from './functions/folderNoteFunctions';
import { ExcludedFolder } from './ExcludeFolders/ExcludeFolder';
import { getFolderPathFromString, getFileExplorerActiveFolder } from './functions/utils';
import {
	deleteExcludedFolder,
	getDetachedFolder,
	getExcludedFolder,
} from './ExcludeFolders/functions/folderFunctions';
import {
	hideFolderNoteInFileExplorer,
	showFolderNoteInFileExplorer,
} from './functions/styleFunctions';



export class Commands {
	plugin: FolderNotesPlugin;
	app: App;
	constructor(app: App, plugin: FolderNotesPlugin) {
		this.plugin = plugin;
		this.app = app;
	}
	registerCommands(): void {
		this.editorCommands();
		this.fileCommands();
		this.regularCommands();
	}

	regularCommands(): void {
		this.plugin.addCommand({
			id: 'move-folder-note-and-folder',
			name: 'Move folder note and folder',
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) {
					new Notice('Open a file first');
					return;
				}
				const linkedFolder = this.getLinkedFolderForActiveFile(file);
				if (!(linkedFolder instanceof TFolder)) {
					// Fallback to Obsidian's default move/rename UX for non-folder-note files.
					this.openDefaultMoveForFile(file);
					return;
				}
				void this.moveFolderNoteAndFolder(file, linkedFolder).catch((error: unknown) => {
					console.error('Folder Notes move command failed', error);
					new Notice('Folder Notes move failed; check console');
				});
			},
		});

		this.plugin.addCommand({
			id: 'turn-into-folder-note',
			name: 'Use this file as the folder note for its parent folder',
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) return false;
				const folder = file.parent;
				if (!folder || !(folder instanceof TFolder)) return false;
				// Only show if file is NOT in the root folder
				if (folder.path === '' || folder.path === '/') return false;
				const folderNote = getFolderNote(this.plugin, folder.path);
				if (folderNote instanceof TFile && folderNote === file) return false;
				if (checking) return true;
				turnIntoFolderNote(this.plugin, file, folder, folderNote);
			},
		});

		this.plugin.addCommand({
			id: 'create-folder-note',
			name: 'Make a folder with this file as its folder note',
			callback: async () => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) return;
				let newPath = file.parent?.path + '/' + file.basename;
				if (file.parent?.path === '' || file.parent?.path === '/') {
					newPath = file.basename;
				}
				if (this.plugin.app.vault.getAbstractFileByPath(newPath)) {
					return new Notice('Folder already exists');
				}
				const automaticallyCreateFolderNote =
					this.plugin.settings.autoCreate;
				this.plugin.settings.autoCreate = false;
				this.plugin.saveSettings();
				await this.plugin.app.vault.createFolder(newPath);
				const folder = this.plugin.app.vault.getAbstractFileByPath(newPath);
				if (!(folder instanceof TFolder)) return;
				createFolderNote(this.plugin, folder.path, true, '.' + file.extension, false, file);
				this.plugin.settings.autoCreate = automaticallyCreateFolderNote;
				this.plugin.saveSettings();
			},
		});

		this.plugin.addCommand({
			id: 'create-folder-note-for-current-folder',
			name: 'Create markdown folder note for this folder',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) return false;
				const folder = file.parent;
				if (!(folder instanceof TFolder)) return false;
				if (folder.path === '' || folder.path === '/') return false;
				if (checking) return true;
				createFolderNote(this.plugin, folder.path, true, '.md', false);
			},
		});

		this.plugin.settings.supportedFileTypes.forEach((fileType) => {
			if (fileType === 'md') return;
			this.plugin.addCommand({
				id: `create-${fileType}-folder-note-for-current-folder`,
				name: `Create ${fileType} folder note for this folder`,
				checkCallback: (checking) => {
					const file = this.app.workspace.getActiveFile();
					if (!(file instanceof TFile)) return false;
					const folder = file.parent;
					if (!(folder instanceof TFolder)) return false;
					if (folder.path === '' || folder.path === '/') return false;
					if (checking) return true;
					createFolderNote(this.plugin, folder.path, true, '.' + fileType, false);
				},
			});
		});
		this.plugin.settings.supportedFileTypes.forEach((fileType) => {
			const type = fileType === 'md' ? 'markdown' : fileType;
			this.plugin.addCommand({
				id: `create-${type}-folder-note-for-active-file-explorer-folder`,
				name: `Create ${type} folder note for current active folder in file explorer`,
				checkCallback: (checking: boolean) => {
					const folder = getFileExplorerActiveFolder();
					if (!folder) return false;
					// Is there already a folder note for the active folder?
					const folderNote = getFolderNote(this.plugin, folder.path);
					if (folderNote instanceof TFile) return false;
					if (checking) return true;

					// Everything is fine and not checking, let's create the folder note.
					const ext = '.' + fileType;
					const { path } = folder;
					createFolderNote(this.plugin, path, true, ext, false);
				},
			});
		});

		this.plugin.addCommand({
			id: 'delete-folder-note-for-current-folder',
			name: 'Delete this folder\'s linked note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) return false;
				const folder = file.parent;
				if (!(folder instanceof TFolder)) return false;
				const folderNote = getFolderNote(this.plugin, folder.path);
				if (!(folderNote instanceof TFile)) return false;
				if (checking) return true;
				deleteFolderNote(this.plugin, folderNote, true);
			},
		});

		this.plugin.addCommand({
			id: 'delete-folder-note-of-active-file-explorer-folder',
			name: 'Delete folder note of current active folder in file explorer',
			checkCallback: (checking: boolean) => {
				const folder = getFileExplorerActiveFolder();
				if (!folder) return false;
				// Is there any folder note for the active folder?
				const folderNote = getFolderNote(this.plugin, folder.path);
				if (!(folderNote instanceof TFile)) return false;
				if (checking) return true;

				// Everything is fine and not checking, let's delete the folder note.
				deleteFolderNote(this.plugin, folderNote, true);
			},
		});
		this.plugin.addCommand({
			id: 'open-folder-note-for-current-folder',
			name: 'Open this folder\'s linked note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) return false;
				const folder = file.parent;
				if (!(folder instanceof TFolder)) return false;
				const folderNote = getFolderNote(this.plugin, folder.path);
				if (!(folderNote instanceof TFile)) return false;
				if (checking) return true;
				openFolderNote(this.plugin, folderNote);
			},
		});
		this.plugin.addCommand({
			id: 'open-folder-note-of-active-file-explorer-folder',
			name: 'Open folder note of current active folder in file explorer',
			checkCallback: (checking: boolean) => {
				const folder = getFileExplorerActiveFolder();
				if (!folder) return false;
				// Is there any folder note for the active folder?
				const folderNote = getFolderNote(this.plugin, folder.path);
				if (!(folderNote instanceof TFile)) return false;
				if (checking) return true;

				// Everything is fine and not checking, let's open the folder note.
				openFolderNote(this.plugin, folderNote);
			},
		});

		this.plugin.addCommand({
			id: 'create-folder-note-from-selected-text',
			name: 'Create folder note from selection',
			editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
				const text = editor.getSelection().trim();
				const { file } = view;
				if (!(file instanceof TFile)) return false;
				if (text && text.trim() !== '') {
					if (checking) { return true; }
					const blacklist = ['*', '\\', '"', '/', '<', '>', '?', '|', ':'];
					for (const char of blacklist) {
						if (text.includes(char)) {
							// eslint-disable-next-line max-len
							new Notice('File name cannot contain any of the following characters: * " \\ / < > : | ?');
							return false;
						}
					}
					if (text.endsWith('.')) {
						new Notice('File name cannot end with a dot');
						return;
					}
					let folder: TAbstractFile | null;
					const folderPath = getFolderPathFromString(file.path);
					if (folderPath === '') {
						folder = this.plugin.app.vault.getAbstractFileByPath(text);
						if (folder instanceof TFolder) {
							new Notice('Folder note already exists');
							return false;
						}
						this.plugin.app.vault.createFolder(text);
						createFolderNote(this.plugin, text, false);

					} else {
						const folderFullPath = folderPath + '/' + text;
						folder = this.plugin.app.vault.getAbstractFileByPath(folderFullPath);
						if (folder instanceof TFolder) {
							new Notice('Folder note already exists');
							return false;
						}
						if (this.plugin.settings.storageLocation === 'parentFolder') {
							if (
								this.app.vault.getAbstractFileByPath(
									folderPath + '/' + text + this.plugin.settings.folderNoteType,
								)
							) {
								new Notice('File already exists');
								return false;
							}
						}
						this.plugin.app.vault.createFolder(folderPath + '/' + text);
						createFolderNote(this.plugin, folderPath + '/' + text, false);
					}

					const { folderNoteName } = this.plugin.settings;
					const fileName = folderNoteName.replace('{{folder_name}}', text);
					if (fileName !== text) {
						editor.replaceSelection(`[[${fileName}]]`);
					} else {
						editor.replaceSelection(`[[${fileName}|${text}]]`);
					}
					return true;
				}
				return false;
			},
		});
	}

	private openDefaultMoveForFile(file: TFile): void {
		const commandIds = [
			'app:move-file',
			'file-explorer:move-file',
		];
		for (const commandId of commandIds) {
			if (this.app.commands.executeCommandById(commandId)) {
				return;
			}
		}
		// Last resort fallback so the hotkey still opens native UI if command IDs differ by version.
		this.plugin.app.fileManager.promptForFileRename(file);
	}

	private getLinkedFolderForActiveFile(file: TFile | null): TFolder | null {
		if (!(file instanceof TFile)) return null;
		const linkedFolder = getFolderNoteFolder(this.plugin, file, file.basename);
		if (!(linkedFolder instanceof TFolder)) return null;
		const linkedFolderNote = getFolderNote(
			this.plugin,
			linkedFolder.path,
			this.plugin.settings.storageLocation,
		);
		if (!(linkedFolderNote instanceof TFile) || linkedFolderNote.path !== file.path) {
			return null;
		}
		return linkedFolder;
	}

	private async chooseDestinationParentPath(initialPath: string): Promise<string | null> {
		const folderPaths = this.plugin.app.vault
			.getAllLoadedFiles()
			.filter((item): item is TFolder => item instanceof TFolder)
			.map((folder) => folder.path)
			.sort((a, b) => a.localeCompare(b));
		const items = ['/', ...folderPaths];
		let selectedPath: string | null = null;
		let resolvePromise: (value: string | null) => void = () => {};
		const result = new Promise<string | null>((resolve) => { resolvePromise = resolve; });

		const modal = new class extends FuzzySuggestModal<string> {
			constructor(app: App) {
				super(app);
			}
			getItems(): string[] {
				return items;
			}
			getItemText(item: string): string {
				return item === '/' ? 'Vault root /' : item;
			}
			onChooseItem(item: string): void {
				selectedPath = item === '/' ? '' : item;
			}
			onClose(): void {
				super.onClose();
				// Obsidian may close the modal before calling onChooseItem; resolve on microtask
				// so a same-tick selection can still update selectedPath.
				queueMicrotask(() => {
					resolvePromise(selectedPath);
				});
			}
		}(this.plugin.app);

		modal.setPlaceholder('Select destination parent folder');
		modal.setInstructions([
			{ command: 'Enter', purpose: 'Move folder note and folder' },
			{ command: 'Esc', purpose: 'Cancel' },
		]);
		const startValue = initialPath.trim() === '' || initialPath === '/' ? '/' : initialPath;
		modal.inputEl.value = startValue;

		modal.open();
		return result;
	}

	private async moveFolderNoteAndFolder(file: TFile, linkedFolder: TFolder): Promise<void> {
		if (this.plugin.settings.storageLocation === 'vaultFolder') {
			new Notice('Move command is not supported for vaultFolder storage');
			return;
		}

		const currentParentPath = getFolderPathFromString(file.path);
		const targetParentPath = await this.chooseDestinationParentPath(currentParentPath);
		if (targetParentPath === null) {
			new Notice('Move cancelled');
			return;
		}

		if (
			targetParentPath === linkedFolder.path ||
			targetParentPath.startsWith(`${linkedFolder.path}/`)
		) {
			new Notice('Cannot move a folder into itself or a subfolder');
			return;
		}

		const newFolderPath = (targetParentPath.trim() === '' || targetParentPath === '/')
			? linkedFolder.name
			: `${targetParentPath}/${linkedFolder.name}`;

		const collisionAtFolderTarget = this.plugin.app.vault.getAbstractFileByPath(newFolderPath);
		if (collisionAtFolderTarget && collisionAtFolderTarget.path !== linkedFolder.path) {
			new Notice('A file or folder with the same name already exists');
			return;
		}

		let targetNotePath = file.path;
		if (this.plugin.settings.storageLocation === 'parentFolder') {
			targetNotePath = (targetParentPath.trim() === '' || targetParentPath === '/')
				? file.name
				: `${targetParentPath}/${file.name}`;
			const collisionAtNoteTarget = this.plugin.app.vault.getAbstractFileByPath(targetNotePath);
			if (collisionAtNoteTarget && collisionAtNoteTarget.path !== file.path) {
				new Notice('A file with the same name already exists in the destination folder');
				return;
			}
		}

		this.plugin.isRunningMoveFolderWithNoteCommand = true;
		try {
			await this.plugin.app.fileManager.renameFile(linkedFolder, newFolderPath);
			if (this.plugin.settings.storageLocation !== 'parentFolder' || file.path === targetNotePath) {
				return;
			}
			try {
				await this.plugin.app.fileManager.renameFile(file, targetNotePath);
			} catch {
				const movedFolder = this.plugin.app.vault.getAbstractFileByPath(newFolderPath);
				if (movedFolder instanceof TFolder) {
					try {
						await this.plugin.app.fileManager.renameFile(movedFolder, linkedFolder.path);
						new Notice('Move failed and changes were reverted');
					} catch {
						new Notice('Move partially failed; please fix folder and note paths manually');
					}
				}
			}
		} finally {
			this.plugin.isRunningMoveFolderWithNoteCommand = false;
		}
	}

	fileCommands(): void {
		this.plugin.registerEvent(
			// eslint-disable-next-line complexity
			this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
				let folder: TAbstractFile | TFolder | null = file.parent;
				if (file instanceof TFile) {
					if (this.plugin.settings.storageLocation === 'insideFolder') {
						folder = file.parent;
					} else {
						const { folderNoteName } = this.plugin.settings;
						const fileName = extractFolderName(folderNoteName, file.basename);
						if (fileName) {
							if (file.parent?.path === '' || file.parent?.path === '/') {
								folder = this.plugin.app.vault.getAbstractFileByPath(fileName);
							} else {
								folder = this.plugin.app.vault.getAbstractFileByPath(
									file.parent?.path + '/' + fileName,
								);
							}
						}
					}

					if (folder instanceof TFolder) {
						const folderNote = getFolderNote(this.plugin, folder.path);
						const excludedFolder = getExcludedFolder(this.plugin, folder.path, true);
						if (folderNote?.path === file.path && !excludedFolder?.detached) { return; }
					} else if (file.parent instanceof TFolder) {
						folder = file.parent;
					}
				}

				// eslint-disable-next-line complexity
				const addFolderNoteActions = (folderMenu: Menu): void => {
					if (file instanceof TFile) {
						folderMenu.addItem((item) => {
							item.setTitle('Create folder note');
							item.setIcon('edit');
							item.onClick(async () => {
								if (!folder) return;
								let newPath = folder.path + '/' + file.basename;
								if (folder.path === '' || folder.path === '/') {
									newPath = file.basename;
								}
								if (this.plugin.app.vault.getAbstractFileByPath(newPath)) {
									return new Notice('Folder already exists');
								}
								const automaticallyCreateFolderNote =
									this.plugin.settings.autoCreate;
								this.plugin.settings.autoCreate = false;
								this.plugin.saveSettings();
								await this.plugin.app.vault.createFolder(newPath);
								const newFolder = this.plugin.app.vault
									.getAbstractFileByPath(newPath);
								if (!(newFolder instanceof TFolder)) return;
								await createFolderNote(
									this.plugin,
									newFolder.path,
									true,
									'.' + file.extension,
									false,
									file,
								);
								this.plugin.settings.autoCreate = automaticallyCreateFolderNote;
								this.plugin.saveSettings();
							});
						});

						if (getFolderPathFromString(file.path) === '') return;

						if (!(folder instanceof TFolder)) return;

						if (folder.path === '' || folder.path === '/') return;

						folderMenu.addItem((item) => {
							item.setTitle(`Turn into folder note for ${folder?.name}`);
							item.setIcon('edit');
							item.onClick(() => {
								if (!folder || !(folder instanceof TFolder)) return;
								const folderNote = getFolderNote(this.plugin, folder.path);
								turnIntoFolderNote(this.plugin, file, folder, folderNote);
							});
						});
					}

					if (!(file instanceof TFolder)) return;

					const excludedFolder = getExcludedFolder(this.plugin, file.path, false);
					const detachedExcludedFolder = getDetachedFolder(this.plugin, file.path);

					if (excludedFolder && !excludedFolder.hideInSettings) {
						// I'm not sure if I'm ever going to add this because of the possibility that a folder got more than one excluded
						// menu.addItem((item) => {
						// 	item.setTitle('Manage excluded folder');
						// 	item.setIcon('settings-2');
						// 	item.onClick(() => {
						//     if (excludedFolder instanceof ExcludedFolder) {
						//       new ExcludedFolderSettings(this.plugin.app, this.plugin, excludedFolder).open();
						//     } else if (excludedFolder instanceof ExcludePattern) {
						//       new PatternSettings(this.plugin.app, this.plugin, excludedFolder).open();
						//     }
						//   });
						// });

						folderMenu.addItem((item) => {
							item.setTitle('Remove folder from excluded folders');
							item.setIcon('trash');
							item.onClick(() => {
								this.plugin.settings.excludeFolders =
									this.plugin.settings.excludeFolders.filter(
										(excluded) =>
											(excluded.path !== file.path) || excluded.detached,
									);
								this.plugin.saveSettings(true);
								new Notice('Successfully removed folder from excluded folders');
							});
						});

						return;
					}

					if (detachedExcludedFolder) {
						folderMenu.addItem((item) => {
							item.setTitle('Remove folder from detached folders');
							item.setIcon('trash');
							item.onClick(() => {
								deleteExcludedFolder(this.plugin, detachedExcludedFolder);
							});
						});
					}

					if (detachedExcludedFolder) { return; }

					folderMenu.addItem((item) => {
						item.setTitle('Exclude folder from folder notes');
						item.setIcon('x-circle');
						item.onClick(() => {
							const newExcludedFolder = new ExcludedFolder(
								file.path,
								this.plugin.settings.excludeFolders.length,
								undefined,
								this.plugin,
							);
							this.plugin.settings.excludeFolders.push(newExcludedFolder);
							this.plugin.saveSettings(true);
							new Notice('Successfully excluded folder from folder notes');
						});
					});

					if (!(file instanceof TFolder)) return;

					const folderNote = getFolderNote(this.plugin, file.path);

					if (folderNote instanceof TFile && !detachedExcludedFolder) {
						folderMenu.addItem((item) => {
							item.setTitle('Delete folder note');
							item.setIcon('trash');
							item.onClick(() => {
								deleteFolderNote(this.plugin, folderNote, true);
							});
						});

						folderMenu.addItem((item) => {
							item.setTitle('Open folder note');
							item.setIcon('chevron-right-square');
							item.onClick(() => {
								openFolderNote(this.plugin, folderNote);
							});
						});

						folderMenu.addItem((item) => {
							item.setTitle('Detach folder note');
							item.setIcon('unlink');
							item.onClick(() => {
								detachFolderNote(this.plugin, folderNote);
							});
						});

						folderMenu.addItem((item) => {
							item.setTitle('Copy Obsidian URL');
							item.setIcon('link');
							item.onClick(() => {
								this.app.copyObsidianUrl(folderNote);
							});
						});

						if (this.plugin.settings.hideFolderNote) {
							if (excludedFolder?.showFolderNote) {
								folderMenu.addItem((item) => {
									item.setTitle('Hide folder note in explorer');
									item.setIcon('eye-off');
									item.onClick(() => {
										hideFolderNoteInFileExplorer(file.path, this.plugin);
									});
								});
							} else {
								folderMenu.addItem((item) => {
									item.setTitle('Show folder note in explorer');
									item.setIcon('eye');
									item.onClick(() => {
										showFolderNoteInFileExplorer(file.path, this.plugin);
									});
								});
							}
						}
					} else {
						folderMenu.addItem((item) => {
							item.setTitle('Create markdown folder note');
							item.setIcon('edit');
							item.onClick(() => {
								createFolderNote(this.plugin, file.path, true, '.md');
							});
						});

						this.plugin.settings.supportedFileTypes.forEach((fileType) => {
							if (fileType === 'md') return;
							folderMenu.addItem((item) => {
								item.setTitle(`Create ${fileType} folder note`);
								item.setIcon('edit');
								item.onClick(() => {
									createFolderNote(this.plugin, file.path, true, '.' + fileType);
								});
							});
						});
					}
				};

				if (
					Platform.isDesktop &&
					!Platform.isTablet &&
					this.plugin.settings.useSubmenus
				) {
					menu.addItem(async (item) => {
						item.setTitle('Folder Note Commands').setIcon('folder-edit');
						let subMenu: Menu = item.setSubmenu() as Menu;
						addFolderNoteActions(subMenu);
					});
				} else {
					addFolderNoteActions(menu);
				}
			}));
	}

	editorCommands(): void {
		// eslint-disable-next-line max-len
		this.plugin.registerEvent(this.plugin.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
			const text = editor.getSelection().trim();
			if (!text || text.trim() === '') return;
			menu.addItem((item) => {
				item.setTitle('Create folder note')
					.setIcon('edit')
					.onClick(() => {
						const { file } = view;
						if (!(file instanceof TFile)) return;
						const blacklist = ['*', '\\', '"', '/', '<', '>', '?', '|', ':'];
						for (const char of blacklist) {
							if (text.includes(char)) {
								// eslint-disable-next-line max-len
								new Notice('File name cannot contain any of the following characters: * " \\ / < > : | ?');
								return;
							}
						}
						if (text.endsWith('.')) {
							new Notice('File name cannot end with a dot');
							return;
						}

						let folder: TAbstractFile | null;
						const folderPath = getFolderPathFromString(file.path);
						const { folderNoteName } = this.plugin.settings;
						const fileName = folderNoteName.replace('{{folder_name}}', text);
						if (folderPath === '') {
							folder = this.plugin.app.vault.getAbstractFileByPath(text);
							if (folder instanceof TFolder) {
								return new Notice('Folder note already exists');
							}
							this.plugin.app.vault.createFolder(text);
							createFolderNote(this.plugin, text, false);

						} else {
							folder = this.plugin.app.vault.getAbstractFileByPath(
								folderPath + '/' + text,
							);
							if (folder instanceof TFolder) {
								return new Notice('Folder note already exists');
							}
							if (this.plugin.settings.storageLocation === 'parentFolder') {
								if (
									this.app.vault.getAbstractFileByPath(
										folderPath +
										'/' +
										fileName +
										this.plugin.settings.folderNoteType,
									)
								) {
									return new Notice('File already exists');
								}
							}
							this.plugin.app.vault.createFolder(folderPath + '/' + text);
							createFolderNote(this.plugin, folderPath + '/' + text, false);
						}
						if (fileName !== text) {
							editor.replaceSelection(`[[${fileName}]]`);
						} else {
							editor.replaceSelection(`[[${fileName}|${text}]]`);
						}
					});
			});
		}));
	}
}
