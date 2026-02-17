import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const vaultArg = process.argv[2] ?? 'sandbox';
const vaultPath = path.resolve(`test-vaults/${vaultArg}`);

if (!existsSync(vaultPath)) {
	throw new Error(`Vault not found: test-vaults/${vaultArg}`);
}

const vaultUrl = `obsidian://open?path=${encodeURIComponent(vaultPath)}`;

function spawnDetached(command, args) {
	const child = spawn(command, args, {
		detached: true,
		stdio: 'ignore',
		windowsHide: true,
	});
	child.unref();
}

if (process.platform === 'win32') {
	spawnDetached('cmd', ['/c', 'start', '', vaultUrl]);
} else if (process.platform === 'darwin') {
	spawnDetached('open', [vaultUrl]);
} else {
	spawnDetached('xdg-open', [vaultUrl]);
}
