import * as vscode from 'vscode';
import { PlanetariumPanel } from './panels/PlanetariumPanel';

export function activate(context: vscode.ExtensionContext) {
	console.log('Planetarium extension is now active!');

	// Register the main command to open the Planetarium view
	const openViewDisposable = vscode.commands.registerCommand('planetarium.openView', () => {
		PlanetariumPanel.createOrShow(context.extensionUri);
	});

	// Add command to subscriptions for proper cleanup
	context.subscriptions.push(openViewDisposable);
}

export function deactivate() {
	// Extension cleanup is handled by individual module disposables
}
