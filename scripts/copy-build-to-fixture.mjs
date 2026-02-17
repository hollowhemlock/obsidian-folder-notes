import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const pluginId = process.argv[2] ?? 'folder-notes';
const targetVault = process.argv[3] ?? 'test-vaults/fixture';
const repoRoot = path.resolve('.');

const sourceFiles = [
	'main.js',
	'manifest.json',
	'styles.css',
];

const targetVaultPath = path.resolve(targetVault);
if (!existsSync(targetVaultPath)) {
	throw new Error(`Target vault not found: ${targetVault}.`);
}

const targetPluginDir = path.join(targetVaultPath, '.obsidian', 'plugins', pluginId);
mkdirSync(targetPluginDir, { recursive: true });

for (const file of sourceFiles) {
	const source = path.join(repoRoot, file);
	if (!existsSync(source)) {
		throw new Error(`Build artifact not found: ${file}. Run "npm run fn-build" first.`);
	}
	copyFileSync(source, path.join(targetPluginDir, file));
}

console.log(`Copied build artifacts to ${path.relative(repoRoot, targetPluginDir)}`);
