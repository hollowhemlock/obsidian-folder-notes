import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const sourceArg = process.argv[2] ?? 'test-vaults/fixture';
const destinationArg = process.argv[3] ?? 'test-vaults/sandbox';

const source = path.resolve(sourceArg);
const destination = path.resolve(destinationArg);

if (!existsSync(source)) {
	throw new Error(`Source vault not found: ${sourceArg}`);
}

if (existsSync(destination)) {
	rmSync(destination, { recursive: true, force: true });
}

mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true, force: true });

console.log(`Prepared sandbox vault at ${destinationArg}`);
