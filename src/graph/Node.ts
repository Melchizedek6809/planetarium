export interface Symbol {
	name: string;
	kind: string;
}

export interface NodePosition {
	x: number;
	y: number;
}

export class FileNode {
	public id: string;
	public path: string;
	public filename: string;
	public symbols: Symbol[];
	public linesOfCode: number;
	public gitStatus: 'added' | 'removed' | 'modified' | 'unchanged';
	public position: NodePosition;
	public width: number;
	public height: number;
	public fx?: number; // Fixed x position for D3 drag
	public fy?: number; // Fixed y position for D3 drag

	constructor(path: string, symbols: Symbol[] = [], linesOfCode: number = 0, gitStatus: 'added' | 'removed' | 'modified' | 'unchanged' = 'unchanged') {
		this.id = path;
		this.path = path;
		this.filename = path.split('/').pop() || path;
		this.symbols = symbols;
		this.linesOfCode = linesOfCode;
		this.gitStatus = gitStatus;
		this.position = { x: 0, y: 0 };
		this.width = this.calculateWidth();
		this.height = this.calculateHeight();
	}

	public updateSymbols(symbols: Symbol[], linesOfCode?: number, gitStatus?: 'added' | 'removed' | 'modified' | 'unchanged'): void {
		this.symbols = symbols;
		if (linesOfCode !== undefined) {
			this.linesOfCode = linesOfCode;
		}
		if (gitStatus !== undefined) {
			this.gitStatus = gitStatus;
		}
		this.width = this.calculateWidth();
		this.height = this.calculateHeight();
	}

	public addSymbol(symbol: Symbol): void {
		this.symbols.push(symbol);
		this.width = this.calculateWidth();
		this.height = this.calculateHeight();
	}

	public getDisplayData() {
		return {
			id: this.id,
			path: this.path,
			filename: this.filename,
			linesOfCode: this.linesOfCode,
			gitStatus: this.gitStatus,
			fileIcon: this.getFileIcon(),
			width: this.width,
			height: this.height,
			x: this.position.x,
			y: this.position.y
		};
	}

	private getFileIcon(): string {
		const extension = this.path.split('.').pop()?.toLowerCase() || '';
		
		// File type icon mapping using Unicode symbols
		const iconMap: Record<string, string> = {
			// JavaScript/TypeScript
			'ts': '📘', 'tsx': '📘', 'js': '📒', 'jsx': '📒', 
			'mts': '📘', 'mjs': '📒', 'cts': '📘', 'cjs': '📒',
			
			// Web technologies
			'html': '🌐', 'htm': '🌐',
			'css': '🎨', 'scss': '🎨', 'sass': '🎨', 'less': '🎨',
			
			// Programming languages
			'py': '🐍', 'pyi': '🐍', 'pyx': '🐍',
			'java': '☕', 'kt': '🟣', 'kts': '🟣', 'scala': '🔴', 'sc': '🔴',
			'c': '⚙️', 'cpp': '⚙️', 'cc': '⚙️', 'cxx': '⚙️', 
			'h': '📋', 'hpp': '📋', 'hh': '📋', 'hxx': '📋',
			'cs': '🔷', 'csx': '🔷',
			'go': '🐹',
			'rs': '🦀',
			'php': '🐘', 'phtml': '🐘',
			'rb': '💎', 'rbw': '💎',
			'swift': '🧡',
			'dart': '🎯',
			'lua': '🌙',
			
			// Shell
			'sh': '🐚', 'bash': '🐚', 'zsh': '🐚', 'fish': '🐚',
			
			// Functional languages
			'hs': '👻', 'lhs': '👻',
			'ml': '🐪', 'mli': '🐪',
			'fs': '🔵', 'fsi': '🔵', 'fsx': '🔵', 'fsscript': '🔵',
			'clj': '🟢', 'cljs': '🟢', 'cljc': '🟢', 'edn': '🟢',
			'elm': '🌳',
			'ex': '💜', 'exs': '💜', 'erl': '💜', 'hrl': '💜',
			
			// Data/Config
			'json': '📋', 'jsonc': '📋',
			'yaml': '📄', 'yml': '📄',
			'xml': '📄',
			'toml': '📄',
			'md': '📝', 'mdx': '📝',
			'tex': '📰',
			
			// Database
			'sql': '🗃️', 'psql': '🗃️', 'mysql': '🗃️',
			
			// Other
			'r': '📊', 'R': '📊',
			'jl': '🔬'
		};
		
		return iconMap[extension] || '📄';
	}

	private calculateWidth(): number {
		const filenameWidth = this.filename.length * 8 + 20;
		return Math.max(120, filenameWidth); // No symbol width since we're not showing symbols
	}

	private calculateHeight(): number {
		const baseHeight = 40; // Height for filename
		const locHeight = 30; // Height for both individual and cumulative LOC (2 lines)
		return baseHeight + locHeight; // No symbol height since we're not showing symbols
	}

	public setPosition(x: number, y: number): void {
		this.position.x = x;
		this.position.y = y;
	}

	public getExportedSymbols(): Symbol[] {
		// For now, return all symbols. Later we can filter for only exported ones
		return this.symbols;
	}
}