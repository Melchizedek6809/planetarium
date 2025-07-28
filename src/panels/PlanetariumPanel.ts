import * as vscode from 'vscode';
import { ProjectGraph } from '../graph/Graph';
import { SymbolService } from '../services/SymbolService';

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
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
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

		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Planetarium</title>
			<script src="https://d3js.org/d3.v7.min.js"></script>
			<style>
				body {
					font-family: var(--vscode-font-family);
					color: var(--vscode-foreground);
					background-color: var(--vscode-editor-background);
					margin: 0;
					padding: 0;
					overflow: hidden;
				}
				#graph {
					width: 100vw;
					height: 100vh;
				}
				.node {
					cursor: pointer;
				}
				.node-background {
					fill: var(--vscode-list-inactiveSelectionBackground);
					stroke: var(--vscode-panel-border);
					stroke-width: 1;
					rx: 8;
				}
				.node:hover .node-background {
					fill: var(--vscode-list-hoverBackground);
				}
				.node-added {
					stroke: var(--vscode-gitDecoration-addedResourceForeground) !important;
					stroke-width: 2 !important;
				}
				.node-removed {
					stroke: var(--vscode-gitDecoration-deletedResourceForeground) !important;
					stroke-width: 2 !important;
				}
				.node-modified {
					stroke: var(--vscode-gitDecoration-modifiedResourceForeground) !important;
					stroke-width: 2 !important;
				}
				.filename {
					fill: var(--vscode-foreground);
					font-family: var(--vscode-editor-font-family);
					font-size: 14px;
					font-weight: bold;
				}
				.file-icon {
					fill: var(--vscode-foreground);
				}
				.loc-text {
					fill: var(--vscode-charts-orange);
					font-family: var(--vscode-editor-font-family);
					font-size: 10px;
					font-style: italic;
					text-anchor: middle;
				}
				.link {
					stroke: var(--vscode-textLink-foreground);
					stroke-width: 2;
					stroke-opacity: 0.7;
				}
				.link:hover {
					stroke: var(--vscode-textLink-activeForeground);
					stroke-width: 3;
					stroke-opacity: 1;
				}
				.link-added {
					stroke: var(--vscode-gitDecoration-addedResourceForeground) !important;
					stroke-width: 3 !important;
				}
				.link-removed {
					stroke: var(--vscode-gitDecoration-deletedResourceForeground) !important;
					stroke-width: 3 !important;
					stroke-dasharray: 5,5 !important;
				}
				.link-unchanged {
					/* Default link styling - no additional changes needed */
				}
				.info-panel {
					position: absolute;
					top: 10px;
					left: 10px;
					background: var(--vscode-editor-background);
					border: 1px solid var(--vscode-panel-border);
					border-radius: 4px;
					padding: 10px;
					font-size: 12px;
					z-index: 1000;
				}
			</style>
		</head>
		<body>
			<div class="info-panel">
				<div>Nodes: ${graphData.nodes.length}</div>
				<div>Edges: ${graphData.edges.length}</div>
				<div>Scroll to zoom, drag to pan</div>
			</div>
			<svg id="graph"></svg>
			<script>
				const vscode = acquireVsCodeApi();
				const data = ${JSON.stringify(graphData)};
				
				const width = window.innerWidth;
				const height = window.innerHeight;
				
				const svg = d3.select("#graph")
					.attr("width", width)
					.attr("height", height);
				
				// Define arrowhead markers for different git statuses
				const defs = svg.append("defs");
				
				// Default arrowhead
				defs.append("marker")
					.attr("id", "arrowhead-unchanged")
					.attr("viewBox", "0 -5 10 10")
					.attr("refX", 10) // Position at the tip of the arrow
					.attr("refY", 0)
					.attr("markerWidth", 8)
					.attr("markerHeight", 8)
					.attr("orient", "auto")
					.append("path")
					.attr("d", "M0,-5L10,0L0,5")
					.style("fill", "var(--vscode-textLink-foreground)");
				
				// Added arrowhead (green)
				defs.append("marker")
					.attr("id", "arrowhead-added")
					.attr("viewBox", "0 -5 10 10")
					.attr("refX", 10)
					.attr("refY", 0)
					.attr("markerWidth", 8)
					.attr("markerHeight", 8)
					.attr("orient", "auto")
					.append("path")
					.attr("d", "M0,-5L10,0L0,5")
					.style("fill", "var(--vscode-gitDecoration-addedResourceForeground)");
				
				// Removed arrowhead (red)
				defs.append("marker")
					.attr("id", "arrowhead-removed")
					.attr("viewBox", "0 -5 10 10")
					.attr("refX", 10)
					.attr("refY", 0)
					.attr("markerWidth", 8)
					.attr("markerHeight", 8)
					.attr("orient", "auto")
					.append("path")
					.attr("d", "M0,-5L10,0L0,5")
					.style("fill", "var(--vscode-gitDecoration-deletedResourceForeground)");
				
				// Create zoom behavior
				const zoom = d3.zoom()
					.scaleExtent([0.1, 4])
					.on("zoom", (event) => {
						container.attr("transform", event.transform);
					});
				
				svg.call(zoom);
				
				const container = svg.append("g");
				
				// Create nodes from graph data and calculate outgoing edge counts
				const outgoingEdgeCounts = new Map();
				data.edges.forEach(edge => {
					const count = outgoingEdgeCounts.get(edge.source) || 0;
					outgoingEdgeCounts.set(edge.source, count + 1);
				});
				
				const maxOutgoingEdges = Math.max(...Array.from(outgoingEdgeCounts.values()), 1);
				
				// Organize initial positions in a circle for better structure
				const centerX = width / 2;
				const centerY = height / 2;
				const radius = Math.min(width, height) / 3;
				
				const nodes = data.nodes.map((node, i) => {
					const angle = (i / data.nodes.length) * 2 * Math.PI;
					return {
						...node,
						x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 100,
						y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 100,
						outgoingEdgeCount: outgoingEdgeCounts.get(node.id) || 0,
						opacity: Math.max(0.3, Math.min(1.0, 0.4 + (outgoingEdgeCounts.get(node.id) || 0) / maxOutgoingEdges * 0.6))
					};
				});
				
				// Process edges from graph data, creating links between node objects
				const nodeMap = new Map(nodes.map(n => [n.id, n]));
				const links = data.edges
					.map(edge => ({
						source: nodeMap.get(edge.source),
						target: nodeMap.get(edge.target),
						symbols: edge.symbols,
						gitStatus: edge.gitStatus || 'unchanged'
					}))
					.filter(link => link.source && link.target);
				
				// Create simulation with link force
				const simulation = d3.forceSimulation(nodes)
					.force("link", d3.forceLink(links).id(d => d.id).distance(150).strength(0.5))
					.force("charge", d3.forceManyBody().strength(-400))
					.force("center", d3.forceCenter(width / 2, height / 2))
					.force("collision", d3.forceCollide().radius(d => Math.max(d.width, d.height) / 2 + 20));
				
				// Create link elements
				const linkElements = container.append("g")
					.selectAll("line")
					.data(links)
					.enter().append("line")
					.attr("class", d => \`link link-\${d.gitStatus}\`)
					.attr("marker-end", d => \`url(#arrowhead-\${d.gitStatus})\`);
					
				// Add tooltips to links
				linkElements.append("title")
					.text(d => \`Imports: \${d.symbols.join(', ')}\`);
				
				// Create node groups
				const node = container.append("g")
					.selectAll("g")
					.data(nodes)
					.enter().append("g")
					.attr("class", "node")
					.on("click", (event, d) => {
						vscode.postMessage({
							command: 'nodeClicked',
							nodePath: d.path
						});
					})
					.call(d3.drag()
						.on("start", dragstarted)
						.on("drag", dragged)
						.on("end", dragended));
				
				// Add background rectangles with opacity based on outgoing edges (only background opacity)
				node.append("rect")
					.attr("class", d => \`node-background node-\${d.gitStatus}\`)
					.attr("width", d => d.width)
					.attr("height", d => d.height)
					.attr("x", d => -d.width / 2)
					.attr("y", d => -d.height / 2)
					.style("fill-opacity", d => d.opacity)
					.style("stroke-opacity", 1.0); // Keep border always visible
				
				// Add file icon
				node.append("text")
					.attr("class", "file-icon")
					.attr("x", d => -d.width / 2 + 15)
					.attr("y", d => -d.height / 2 + 20)
					.style("font-size", "16px")
					.style("text-anchor", "middle")
					.text(d => d.fileIcon);

				// Add filename text (always full opacity)
				node.append("text")
					.attr("class", "filename")
					.attr("x", d => -d.width / 2 + 35)
					.attr("y", d => -d.height / 2 + 20)
					.style("text-anchor", "start")
					.text(d => d.filename);
				
				// Add individual lines of code text (always full opacity)
				node.append("text")
					.attr("class", "loc-text")
					.attr("y", d => -d.height / 2 + 35)
					.text(d => \`\${d.linesOfCode} LOC\`);
				
				// Add cumulative lines of code text (always full opacity)
				node.append("text")
					.attr("class", "loc-text")
					.attr("y", d => -d.height / 2 + 50)
					.style("font-weight", "bold")
					.text(d => \`\${d.cumulativeLOC} total LOC\`);
				
				// Helper function to calculate edge connection points for rectangular nodes
				function getEdgePoint(source, target, isSource) {
					const dx = target.x - source.x;
					const dy = target.y - source.y;
					const distance = Math.sqrt(dx * dx + dy * dy);
					
					if (distance === 0) return { x: source.x, y: source.y };
					
					const nodeData = isSource ? source : target;
					const nodeX = isSource ? source.x : target.x;
					const nodeY = isSource ? source.y : target.y;
					
					// Calculate unit vector
					const ux = dx / distance;
					const uy = dy / distance;
					
					// Calculate intersection with rectangular node border
					const halfWidth = nodeData.width / 2;
					const halfHeight = nodeData.height / 2;
					
					// Find intersection point with rectangle edges
					let intersectionX, intersectionY;
					
					// Check which edge the line intersects
					const slope = Math.abs(uy / ux);
					const rectSlope = halfHeight / halfWidth;
					
					if (slope <= rectSlope) {
						// Intersects left or right edge
						intersectionX = ux > 0 ? halfWidth : -halfWidth;
						intersectionY = intersectionX * (uy / ux);
					} else {
						// Intersects top or bottom edge  
						intersectionY = uy > 0 ? halfHeight : -halfHeight;
						intersectionX = intersectionY * (ux / uy);
					}
					
					if (isSource) {
						return {
							x: nodeX + intersectionX,
							y: nodeY + intersectionY
						};
					} else {
						return {
							x: nodeX - intersectionX,
							y: nodeY - intersectionY
						};
					}
				}

				// Update positions on simulation tick
				simulation.on("tick", () => {
					linkElements
						.attr("x1", d => {
							const point = getEdgePoint(d.source, d.target, true);
							return point.x;
						})
						.attr("y1", d => {
							const point = getEdgePoint(d.source, d.target, true);
							return point.y;
						})
						.attr("x2", d => {
							const point = getEdgePoint(d.source, d.target, false);
							return point.x;
						})
						.attr("y2", d => {
							const point = getEdgePoint(d.source, d.target, false);
							return point.y;
						});
					
					node.attr("transform", d => \`translate(\${d.x},\${d.y})\`);
				});
				
				// Drag functions
				function dragstarted(event, d) {
					if (!event.active) simulation.alphaTarget(0.3).restart();
					d.fx = d.x;
					d.fy = d.y;
				}
				
				function dragged(event, d) {
					d.fx = event.x;
					d.fy = event.y;
				}
				
				function dragended(event, d) {
					if (!event.active) simulation.alphaTarget(0);
					d.fx = null;
					d.fy = null;
				}
				
				// Handle window resize
				window.addEventListener('resize', () => {
					const newWidth = window.innerWidth;
					const newHeight = window.innerHeight;
					svg.attr("width", newWidth).attr("height", newHeight);
					simulation.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));
				});
			</script>
		</body>
		</html>`;
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