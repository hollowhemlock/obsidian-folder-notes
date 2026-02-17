import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const isContentOnly = args.includes('--content-only');
const isFull = args.includes('--full');
const positionalArgs = args.filter((arg) => arg !== '--content-only' && arg !== '--full');

if (isContentOnly && isFull) {
	throw new Error('Use only one mode: --full or --content-only');
}

const sourceArg = positionalArgs[0] ?? 'test-vaults/fixture';
const destinationArg = positionalArgs[1] ?? 'test-vaults/sandbox';
const source = path.resolve(sourceArg);
const destination = path.resolve(destinationArg);

if (!existsSync(source)) {
	throw new Error(`Source vault not found: ${sourceArg}`);
}

if (isContentOnly) {
	// Keep destination .obsidian intact so hot-reload/plugin state survives, refresh all other content.
	if (!existsSync(destination)) {
		mkdirSync(destination, { recursive: true });
	}

	for (const entry of readdirSync(destination)) {
		if (entry === '.obsidian') { continue; }
		rmSync(path.join(destination, entry), { recursive: true, force: true });
	}

	for (const entry of readdirSync(source)) {
		if (entry === '.obsidian') { continue; }
		cpSync(path.join(source, entry), path.join(destination, entry), {
			recursive: true,
			force: true,
		});
	}

	console.log(`Refreshed content from ${sourceArg} into ${destinationArg} (preserved .obsidian)`);
} else {
	// Default/full mode: replace destination vault entirely with source vault.
	if (existsSync(destination)) {
		rmSync(destination, { recursive: true, force: true });
	}
	mkdirSync(destination, { recursive: true });
	cpSync(source, destination, { recursive: true, force: true });
	console.log(`Prepared vault at ${destinationArg} from ${sourceArg}`);
}
