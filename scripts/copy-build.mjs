import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('.');
const manifestPath = path.join(repoRoot, 'manifest.json');
const rawArgs = process.argv.slice(2);
const presetMap = {
	'--fixture': ['test-vaults/fixture'],
	'--sandbox': ['test-vaults/sandbox'],
	'--both': ['test-vaults/fixture', 'test-vaults/sandbox'],
};

function getManifestPluginId() {
	if (!existsSync(manifestPath)) {
		throw new Error('manifest.json not found in repo root.');
	}
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	if (!manifest?.id || typeof manifest.id !== 'string') {
		throw new Error('manifest.json is missing a valid string "id".');
	}
	return manifest.id;
}

let pluginId;
let targetVaults;
const presetArg = rawArgs.find((arg) => Object.hasOwn(presetMap, arg));
if (presetArg) {
	pluginId = getManifestPluginId();
	targetVaults = presetMap[presetArg];
} else {
	const [arg1, ...restArgs] = rawArgs;

	if (arg1 && !arg1.includes('/') && !arg1.includes('\\') && restArgs.length > 0) {
		pluginId = arg1;
		targetVaults = restArgs;
	} else {
		pluginId = getManifestPluginId();
		targetVaults = rawArgs;
	}
}

if (!pluginId || targetVaults.length === 0) {
	throw new Error('Usage: node ./scripts/copy-build.mjs [--fixture|--sandbox|--both] | [plugin-id] <target-vault-path> [more-target-vault-paths...]');
}

const sourceFiles = [
	'main.js',
	'manifest.json',
	'styles.css',
];

for (const targetVault of targetVaults) {
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
}
