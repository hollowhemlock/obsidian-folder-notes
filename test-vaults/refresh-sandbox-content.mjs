import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

// This script is for live testing with Hot Reload enabled in the sandbox vault.
// We intentionally preserve sandbox/.obsidian so plugin enablement, settings, and
// watcher state are not reset while refreshing markdown/test content from fixture.
const sourceArg = process.argv[2] ?? 'test-vaults/fixture';
const destinationArg = process.argv[3] ?? 'test-vaults/sandbox';

const source = path.resolve(sourceArg);
const destination = path.resolve(destinationArg);

if (!existsSync(source)) {
	throw new Error(`Source vault not found: ${sourceArg}`);
}

if (!existsSync(destination)) {
	mkdirSync(destination, { recursive: true });
}

// Remove everything in sandbox except .obsidian so plugin/runtime state survives.
for (const entry of readdirSync(destination)) {
	if (entry === '.obsidian') { continue; }
	rmSync(path.join(destination, entry), { recursive: true, force: true });
}

// Copy fixture content except .obsidian.
for (const entry of readdirSync(source)) {
	if (entry === '.obsidian') { continue; }
	cpSync(path.join(source, entry), path.join(destination, entry), {
		recursive: true,
		force: true,
	});
}

console.log(`Refreshed sandbox content from ${sourceArg} into ${destinationArg} (preserved .obsidian)`);
