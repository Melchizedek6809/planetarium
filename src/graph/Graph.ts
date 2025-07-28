import { FileNode, Symbol } from './Node';

export interface Edge {
	source: string; // Node ID
	target: string; // Node ID
	symbols: string[]; // Which symbols are being imported
	gitStatus?: 'added' | 'removed' | 'unchanged'; // Git status of this dependency
}

export interface GraphData {
	nodes: ReturnType<FileNode['getDisplayData']>[];
	edges: Edge[];
}

export class ProjectGraph {
	private nodes: Map<string, FileNode> = new Map();
	private edges: Edge[] = [];

	public addNode(path: string, symbols: Symbol[] = [], linesOfCode: number = 0, gitStatus: 'added' | 'removed' | 'modified' | 'unchanged' = 'unchanged'): FileNode {
		const existingNode = this.nodes.get(path);
		if (existingNode) {
			existingNode.updateSymbols(symbols, linesOfCode, gitStatus);
			return existingNode;
		}

		const node = new FileNode(path, symbols, linesOfCode, gitStatus);
		this.nodes.set(path, node);
		return node;
	}

	public getNode(path: string): FileNode | undefined {
		return this.nodes.get(path);
	}

	public getAllNodes(): FileNode[] {
		return Array.from(this.nodes.values());
	}

	public addEdge(source: string, target: string, symbols: string[] = [], gitStatus: 'added' | 'removed' | 'unchanged' = 'unchanged'): void {
		// Check if edge already exists
		const existingEdge = this.edges.find(e => e.source === source && e.target === target);
		if (existingEdge) {
			// Merge symbols and update git status if needed
			existingEdge.symbols = [...new Set([...existingEdge.symbols, ...symbols])];
			if (gitStatus !== 'unchanged') {
				existingEdge.gitStatus = gitStatus;
			}
		} else {
			this.edges.push({ source, target, symbols, gitStatus });
		}
	}

	public getEdges(): Edge[] {
		return this.edges;
	}

	public removeNode(path: string): boolean {
		const removed = this.nodes.delete(path);
		if (removed) {
			// Remove all edges involving this node
			this.edges = this.edges.filter(e => e.source !== path && e.target !== path);
		}
		return removed;
	}

	public clear(): void {
		this.nodes.clear();
		this.edges = [];
	}

	public getGraphData(): GraphData {
		// Calculate cumulative LOC for each node (node + all its dependencies)
		const nodesWithCumulativeLOC = Array.from(this.nodes.values()).map(node => {
			const cumulativeLOC = this.calculateCumulativeLOC(node.path);
			return {
				...node.getDisplayData(),
				cumulativeLOC: cumulativeLOC
			};
		});

		return {
			nodes: nodesWithCumulativeLOC,
			edges: this.edges
		};
	}

	private calculateCumulativeLOC(nodePath: string): number {
		const node = this.nodes.get(nodePath);
		if (!node) {
			return 0;
		}

		// Start with this node's LOC
		let totalLOC = node.linesOfCode;

		// Add LOC from direct dependencies only (no recursion)
		const directDependencies = this.getDependencies(nodePath);
		for (const dep of directDependencies) {
			totalLOC += dep.linesOfCode;
		}

		return totalLOC;
	}

	public getNodeCount(): number {
		return this.nodes.size;
	}

	public getEdgeCount(): number {
		return this.edges.length;
	}

	// Future method for analyzing dependencies
	public getDependencies(nodePath: string): FileNode[] {
		const dependencies: FileNode[] = [];
		const dependencyEdges = this.edges.filter(e => e.source === nodePath);
		
		for (const edge of dependencyEdges) {
			const targetNode = this.nodes.get(edge.target);
			if (targetNode) {
				dependencies.push(targetNode);
			}
		}
		
		return dependencies;
	}

	// Future method for analyzing dependents
	public getDependents(nodePath: string): FileNode[] {
		const dependents: FileNode[] = [];
		const dependentEdges = this.edges.filter(e => e.target === nodePath);
		
		for (const edge of dependentEdges) {
			const sourceNode = this.nodes.get(edge.source);
			if (sourceNode) {
				dependents.push(sourceNode);
			}
		}
		
		return dependents;
	}

	// Method to update node positions (useful for saving/restoring layout)
	public updateNodePositions(positions: Map<string, { x: number, y: number }>): void {
		for (const [nodePath, position] of positions) {
			const node = this.nodes.get(nodePath);
			if (node) {
				node.setPosition(position.x, position.y);
			}
		}
	}
}