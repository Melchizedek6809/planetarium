import * as vscode from 'vscode';
import { ProjectGraph } from '../graph/Graph';
import { SymbolService } from '../services/SymbolService';
import htmlTemplate from '../media/template.html';
import cssStyles from '../media/styles.css';

export class PlanetariumPanel {
	public static currentPanel: PlanetariumPanel | undefined;
	public static readonly viewType = 'planetarium.view';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _graph: ProjectGraph;
	private readonly _symbolService: SymbolService;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (PlanetariumPanel.currentPanel) {
			PlanetariumPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			PlanetariumPanel.viewType,
			'Planetarium',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, 'media'),
					vscode.Uri.joinPath(extensionUri, 'dist')
				]
			}
		);

		PlanetariumPanel.currentPanel = new PlanetariumPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._graph = new ProjectGraph();
		this._symbolService = new SymbolService();

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'nodeClicked':
						this._handleNodeClick(message.nodePath);
						break;
					case 'symbolClicked':
						this._handleSymbolClick(message.nodePath, message.symbolName);
						break;
					case 'refresh':
						this._update();
						break;
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		PlanetariumPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private async _update() {
		const webview = this._panel.webview;
		this._panel.title = 'Planetarium';

		// Build the graph with current workspace data
		await this._buildGraph();

		this._panel.webview.html = this._getHtmlForWebview(webview);
	}

	private async _buildGraph() {
		// Clear existing graph
		this._graph.clear();

		// Get files with their symbols, dependencies, and git status
		const filesWithGitStatus = await this._symbolService.getFilesWithDependenciesAndGitStatus();

		// Add all nodes first
		for (const fileData of filesWithGitStatus) {
			this._graph.addNode(fileData.path, fileData.symbols, fileData.linesOfCode, fileData.gitStatus);
		}

		// Add edges based on import relationships and detect edge changes
		for (const fileData of filesWithGitStatus) {
			for (const dependency of fileData.dependencies) {
				// Determine edge git status
				let edgeGitStatus: 'added' | 'removed' | 'unchanged' = 'unchanged';

				// If the source file is new, all its dependencies are new edges
				if (fileData.gitStatus === 'added') {
					edgeGitStatus = 'added';
				}
				// If the source file is modified, we need to check if this dependency existed before
				else if (fileData.gitStatus === 'modified') {
					// For now, assume all dependencies of modified files are unchanged
					// TODO: Could implement more sophisticated edge change detection
					edgeGitStatus = 'unchanged';
				}

				this._graph.addEdge(fileData.path, dependency.importedFrom, dependency.symbols, edgeGitStatus);
			}
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const graphData = this._graph.getGraphData();

		// Get the webview script URI
		const webviewScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));

		return htmlTemplate
			.replace('{{CSS_PLACEHOLDER}}', `<style>${cssStyles}</style>`)
			.replace('{{NODE_COUNT}}', graphData.nodes.length.toString())
			.replace('{{EDGE_COUNT}}', graphData.edges.length.toString())
			.replace('{{GRAPH_DATA}}', JSON.stringify(graphData))
			.replace('{{WEBVIEW_SCRIPT}}', `<script src="${webviewScriptUri}"></script>`);
	}

	private async _handleNodeClick(nodePath: string) {
		// Navigate to the file when a node is clicked
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				return;
			}

			const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, nodePath);
			const document = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(document);
		} catch (error) {
			console.error(`Error opening file ${nodePath}:`, error);
			vscode.window.showErrorMessage(`Could not open file: ${nodePath}`);
		}
	}

	private async _handleSymbolClick(nodePath: string, symbolName: string) {
		// Navigate to specific symbol definition when clicked
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				return;
			}

			const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, nodePath);
			const document = await vscode.workspace.openTextDocument(fileUri);

			// Get document symbols to find the specific symbol
			const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
				'vscode.executeDocumentSymbolProvider',
				fileUri
			);

			if (symbols) {
				// Find the symbol by name (remove the type annotation like "(fn)")
				const cleanSymbolName = symbolName.replace(/\s*\([^)]*\)$/, '');
				const targetSymbol = this._findSymbolByName(symbols, cleanSymbolName);

				if (targetSymbol) {
					// Open the document and navigate to the symbol
					const editor = await vscode.window.showTextDocument(document);
					const range = targetSymbol.selectionRange || targetSymbol.range;
					editor.selection = new vscode.Selection(range.start, range.end);
					editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
					return;
				}
			}

			// Fallback: just open the file
			await vscode.window.showTextDocument(document);
		} catch (error) {
			console.error(`Error navigating to symbol ${symbolName} in ${nodePath}:`, error);
			vscode.window.showErrorMessage(`Could not navigate to symbol: ${symbolName}`);
		}
	}

	private _findSymbolByName(symbols: vscode.DocumentSymbol[], name: string): vscode.DocumentSymbol | null {
		for (const symbol of symbols) {
			if (symbol.name === name) {
				return symbol;
			}
			// Search nested symbols
			if (symbol.children) {
				const found = this._findSymbolByName(symbol.children, name);
				if (found) {
					return found;
				}
			}
		}
		return null;
	}
}