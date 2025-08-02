// @ts-ignore - VS Code API is injected at runtime
declare const acquireVsCodeApi: () => any;

// Import d3 library
import * as d3 from 'd3';

interface GraphData {
	nodes: Array<{
		id: string;
		path: string;
		filename: string;
		fileIcon: string;
		linesOfCode: number;
		cumulativeLOC: number;
		width: number;
		height: number;
		gitStatus: 'added' | 'removed' | 'modified' | 'unchanged';
		x?: number;
		y?: number;
		fx?: number | null;
		fy?: number | null;
		outgoingEdgeCount?: number;
		opacity?: number;
	}>;
	edges: Array<{
		source: string;
		target: string;
		symbols: string[];
		gitStatus: 'added' | 'removed' | 'unchanged';
	}>;
}

interface GraphNode {
	id: string;
	path: string;
	filename: string;
	fileIcon: string;
	linesOfCode: number;
	cumulativeLOC: number;
	width: number;
	height: number;
	gitStatus: 'added' | 'removed' | 'modified' | 'unchanged';
	x: number;
	y: number;
	fx?: number | null;
	fy?: number | null;
	outgoingEdgeCount: number;
	opacity: number;
}

interface GraphLink {
	source: GraphNode;
	target: GraphNode;
	symbols: string[];
	gitStatus: 'added' | 'removed' | 'unchanged';
}

class PlanetariumWebview {
	private vscode: any;
	private data: GraphData;
	private width: number;
	private height: number;
	private svg!: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
	private container!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
	private simulation!: d3.Simulation<GraphNode, GraphLink>;

	constructor(data: GraphData) {
		this.vscode = acquireVsCodeApi();
		this.data = data;
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		
		this.initializeVisualization();
		this.setupEventListeners();
	}

	private initializeVisualization(): void {
		this.svg = d3.select<SVGSVGElement, unknown>("#graph")
			.attr("width", this.width)
			.attr("height", this.height);

		this.setupArrowheadMarkers();
		this.setupZoom();
		this.createGraph();
	}

	private setupArrowheadMarkers(): void {
		const defs = this.svg.append("defs");

		// Default arrowhead
		defs.append("marker")
			.attr("id", "arrowhead-unchanged")
			.attr("viewBox", "0 -5 10 10")
			.attr("refX", 10)
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
	}

	private setupZoom(): void {
		const zoom = d3.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 4])
			.on("zoom", (event) => {
				this.container.attr("transform", event.transform);
			});

		this.svg.call(zoom);
		this.container = this.svg.append("g");
	}

	private createGraph(): void {
		// Calculate outgoing edge counts
		const outgoingEdgeCounts = new Map<string, number>();
		this.data.edges.forEach(edge => {
			const count = outgoingEdgeCounts.get(edge.source) || 0;
			outgoingEdgeCounts.set(edge.source, count + 1);
		});

		const maxOutgoingEdges = Math.max(...Array.from(outgoingEdgeCounts.values()), 1);

		// Create nodes with initial positions
		const nodes: GraphNode[] = this.data.nodes.map((node, i) => {
			const angle = (i / this.data.nodes.length) * 2 * Math.PI;
			const centerX = this.width / 2;
			const centerY = this.height / 2;
			const radius = Math.min(this.width, this.height) / 3;

			return {
				...node,
				x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 100,
				y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 100,
				outgoingEdgeCount: outgoingEdgeCounts.get(node.id) || 0,
				opacity: Math.max(0.3, Math.min(1.0, 0.4 + (outgoingEdgeCounts.get(node.id) || 0) / maxOutgoingEdges * 0.6))
			};
		});

		// Create links
		const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
		const links: GraphLink[] = this.data.edges
			.map(edge => ({
				source: nodeMap.get(edge.source)!,
				target: nodeMap.get(edge.target)!,
				symbols: edge.symbols,
				gitStatus: edge.gitStatus || 'unchanged'
			}))
			.filter(link => link.source && link.target);

		// Create simulation
		this.simulation = d3.forceSimulation(nodes)
			.force("link", d3.forceLink(links).id((d: any) => d.id).distance(150).strength(0.5))
			.force("charge", d3.forceManyBody().strength(-400))
			.force("center", d3.forceCenter(this.width / 2, this.height / 2))
			.force("collision", d3.forceCollide().radius((d: any) => Math.max(d.width, d.height) / 2 + 20));

		this.createLinks(links);
		this.createNodes(nodes);
		this.startSimulation(links, nodes);
	}

	private createLinks(links: GraphLink[]): void {
		const linkElements = this.container.append("g")
			.selectAll("line")
			.data(links)
			.enter().append("line")
			.attr("class", d => `link link-${d.gitStatus}`)
			.attr("marker-end", d => `url(#arrowhead-${d.gitStatus})`);

		// Add tooltips to links
		linkElements.append("title")
			.text(d => `Imports: ${d.symbols.join(', ')}`);

		// Store reference for simulation updates
		(this.simulation as any).linkElements = linkElements;
	}

	private createNodes(nodes: GraphNode[]): void {
		const nodeElements = this.container.append("g")
			.selectAll("g")
			.data(nodes)
			.enter().append("g")
			.attr("class", "node")
			.on("click", (event, d) => {
				this.vscode.postMessage({
					command: 'nodeClicked',
					nodePath: d.path
				});
			})
			.call(d3.drag<SVGGElement, GraphNode>()
				.on("start", (event, d) => this.dragStarted(event, d))
				.on("drag", (event, d) => this.dragged(event, d))
				.on("end", (event, d) => this.dragEnded(event, d)));

		// Add background rectangles
		nodeElements.append("rect")
			.attr("class", d => `node-background node-${d.gitStatus}`)
			.attr("width", d => d.width)
			.attr("height", d => d.height)
			.attr("x", d => -d.width / 2)
			.attr("y", d => -d.height / 2)
			.style("fill-opacity", d => d.opacity)
			.style("stroke-opacity", 1.0);

		// Add file icon
		nodeElements.append("text")
			.attr("class", "file-icon")
			.attr("x", d => -d.width / 2 + 15)
			.attr("y", d => -d.height / 2 + 20)
			.style("font-size", "16px")
			.style("text-anchor", "middle")
			.text(d => d.fileIcon);

		// Add filename text
		nodeElements.append("text")
			.attr("class", "filename")
			.attr("x", d => -d.width / 2 + 35)
			.attr("y", d => -d.height / 2 + 20)
			.style("text-anchor", "start")
			.text(d => d.filename);

		// Add individual lines of code text
		nodeElements.append("text")
			.attr("class", "loc-text")
			.attr("y", d => -d.height / 2 + 35)
			.text(d => `${d.linesOfCode} LOC`);

		// Add cumulative lines of code text
		nodeElements.append("text")
			.attr("class", "loc-text")
			.attr("y", d => -d.height / 2 + 50)
			.style("font-weight", "bold")
			.text(d => `${d.cumulativeLOC} total LOC`);

		// Store reference for simulation updates
		(this.simulation as any).nodeElements = nodeElements;
	}

	private startSimulation(links: GraphLink[], nodes: GraphNode[]): void {
		const linkElements = (this.simulation as any).linkElements;
		const nodeElements = (this.simulation as any).nodeElements;

		this.simulation.on("tick", () => {
			linkElements
				.attr("x1", (d: GraphLink) => {
					const point = this.getEdgePoint(d.source, d.target, true);
					return point.x;
				})
				.attr("y1", (d: GraphLink) => {
					const point = this.getEdgePoint(d.source, d.target, true);
					return point.y;
				})
				.attr("x2", (d: GraphLink) => {
					const point = this.getEdgePoint(d.source, d.target, false);
					return point.x;
				})
				.attr("y2", (d: GraphLink) => {
					const point = this.getEdgePoint(d.source, d.target, false);
					return point.y;
				});

			nodeElements.attr("transform", (d: GraphNode) => `translate(${d.x},${d.y})`);
		});
	}

	private getEdgePoint(source: GraphNode, target: GraphNode, isSource: boolean): { x: number; y: number } {
		const dx = target.x - source.x;
		const dy = target.y - source.y;
		const distance = Math.sqrt(dx * dx + dy * dy);

		if (distance === 0) {
			return { x: source.x, y: source.y };
		}

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
		let intersectionX: number, intersectionY: number;

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

	private dragStarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode): void {
		if (!event.active) {
			this.simulation.alphaTarget(0.3).restart();
		}
		d.fx = d.x;
		d.fy = d.y;
	}

	private dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode): void {
		d.fx = event.x;
		d.fy = event.y;
	}

	private dragEnded(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode): void {
		if (!event.active) {
			this.simulation.alphaTarget(0);
		}
		d.fx = null;
		d.fy = null;
	}

	private setupEventListeners(): void {
		window.addEventListener('resize', () => {
			const newWidth = window.innerWidth;
			const newHeight = window.innerHeight;
			this.width = newWidth;
			this.height = newHeight;
			this.svg.attr("width", newWidth).attr("height", newHeight);
			this.simulation.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));
		});
	}
}

// Initialize the webview when the script loads
declare global {
	interface Window {
		graphData: GraphData;
	}
}

// The graph data will be injected by the extension
window.addEventListener('DOMContentLoaded', () => {
	if (window.graphData) {
		new PlanetariumWebview(window.graphData);
	}
});