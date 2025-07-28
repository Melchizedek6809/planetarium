import * as vscode from 'vscode';
import { Symbol } from '../graph/Node';

export class SymbolService {
	
	public async getWorkspaceFiles(): Promise<vscode.Uri[]> {
		if (!vscode.workspace.workspaceFolders) {
			return [];
		}

		// Use VS Code's built-in file search with gitignore respect
		// Include all common file types that typically have LSP support
		const fileUris = await vscode.workspace.findFiles(
			'**/*.{' +
			// JavaScript/TypeScript
			'ts,js,tsx,jsx,mts,mjs,cts,cjs,' +
			// Web technologies
			'html,htm,css,scss,sass,less,' +
			// Python
			'py,pyi,pyx,' +
			// Java/Kotlin/Scala
			'java,kt,kts,scala,sc,' +
			// C/C++
			'c,cpp,cc,cxx,h,hpp,hh,hxx,' +
			// C#
			'cs,csx,' +
			// Go
			'go,' +
			// Rust
			'rs,' +
			// PHP
			'php,phtml,' +
			// Ruby
			'rb,rbw,' +
			// Swift
			'swift,' +
			// Dart
			'dart,' +
			// Lua
			'lua,' +
			// Shell
			'sh,bash,zsh,fish,' +
			// Config/Data formats that might have symbols (excluding json, yml, md per user request)
			'toml,xml,' +
			// Documentation with possible symbols
			'tex,' +
			// SQL
			'sql,psql,mysql,' +
			// Other common languages
			'r,R,jl,elm,ex,exs,erl,hrl,hs,lhs,ml,mli,fs,fsi,fsx,fsscript,clj,cljs,cljc,edn' +
			'}',
			'{**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/target/**,**/.git/**,**/*.vsix,**/coverage/**,**/.nyc_output/**}' // Exclude common ignore patterns
		);

		return fileUris;
	}

	public async getFileSymbols(uri: vscode.Uri): Promise<Symbol[]> {
		try {
			// Get both document symbols and the file content to analyze exports
			const [symbols, document] = await Promise.all([
				vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
					'vscode.executeDocumentSymbolProvider',
					uri
				),
				vscode.workspace.openTextDocument(uri)
			]);

			if (!symbols) {
				return [];
			}

			const fileContent = document.getText();
			const exportedSymbols: Symbol[] = [];
			
			const extractExportedSymbols = (symbolList: vscode.DocumentSymbol[]) => {
				for (const symbol of symbolList) {
					// Check if this symbol is exported by looking at the text around its range
					const symbolText = fileContent.substring(
						document.offsetAt(symbol.range.start),
						document.offsetAt(symbol.range.end)
					);
					
					const lineStart = document.offsetAt(new vscode.Position(symbol.range.start.line, 0));
					const lineText = fileContent.substring(
						lineStart,
						document.offsetAt(symbol.range.end)
					);

					// Check if the symbol is exported (various export patterns)
					if (this.isExportedSymbol(lineText, symbol.name, fileContent)) {
						exportedSymbols.push({
							name: symbol.name,
							kind: this.getSymbolKindLabel(symbol.kind)
						});
					}
					
					// Skip adding individual methods and properties - they clutter the view
					// We only show the main exported symbols (classes, functions, interfaces, etc.)
				}
			};

			extractExportedSymbols(symbols);
			return exportedSymbols.slice(0, 15); // Increase limit slightly for exported symbols
		} catch (error) {
			console.error(`Error getting symbols for ${uri.fsPath}:`, error);
			return [];
		}
	}

	private isExportedSymbol(lineText: string, symbolName: string, fileContent: string): boolean {
		// For non-JS/TS files, consider all top-level symbols as "exported"
		const filePath = fileContent.substring(0, 100); // Just check beginning for file type hints
		if (!this.isJavaScriptTypeFile(fileContent)) {
			// For HTML, CSS, Python, etc., all symbols are considered public/accessible
			return true;
		}

		// JavaScript/TypeScript export patterns
		const exportPatterns = [
			`export function ${symbolName}`,
			`export class ${symbolName}`,
			`export interface ${symbolName}`,
			`export const ${symbolName}`,
			`export let ${symbolName}`,
			`export var ${symbolName}`,
			`export enum ${symbolName}`,
			`export type ${symbolName}`,
			`export default ${symbolName}`,
			`export { ${symbolName}`,
			`export {${symbolName}`,
		];

		const lowerLineText = lineText.toLowerCase();
		const lowerSymbolName = symbolName.toLowerCase();

		// Check direct export patterns
		for (const pattern of exportPatterns) {
			if (lowerLineText.includes(pattern.toLowerCase())) {
				return true;
			}
		}

		// Check for export statements at the end of file
		const exportRegex = new RegExp(`export\\s*{[^}]*\\b${symbolName}\\b[^}]*}`, 'i');
		if (exportRegex.test(fileContent)) {
			return true;
		}

		// Check for default export
		const defaultExportRegex = new RegExp(`export\\s+default\\s+${symbolName}`, 'i');
		if (defaultExportRegex.test(fileContent)) {
			return true;
		}

		return false;
	}

	private isJavaScriptTypeFile(fileContent: string): boolean {
		// Check for common JS/TS patterns to determine if we should apply export filtering
		const jsPatterns = [
			/\bimport\s+.*\bfrom\b/,
			/\bexport\s+/,
			/\bmodule\.exports\b/,
			/\brequire\s*\(/,
			/\bfunction\s+\w+\s*\(/,
			/\bclass\s+\w+/,
			/\binterface\s+\w+/
		];

		return jsPatterns.some(pattern => pattern.test(fileContent));
	}

	public async getFilesWithSymbols(): Promise<Array<{path: string, symbols: Symbol[]}>> {
		const fileUris = await this.getWorkspaceFiles();
		const filesWithSymbols: Array<{path: string, symbols: Symbol[]}> = [];

		for (const uri of fileUris) {
			const relativePath = vscode.workspace.asRelativePath(uri);
			const symbols = await this.getFileSymbols(uri);
			filesWithSymbols.push({
				path: relativePath,
				symbols: symbols
			});
		}

		return filesWithSymbols.sort((a, b) => a.path.localeCompare(b.path));
	}

	private getSymbolKindLabel(kind: vscode.SymbolKind): string {
		switch (kind) {
			case vscode.SymbolKind.Function: return 'fn';
			case vscode.SymbolKind.Class: return 'class';
			case vscode.SymbolKind.Interface: return 'interface';
			case vscode.SymbolKind.Variable: return 'var';
			case vscode.SymbolKind.Constant: return 'const';
			case vscode.SymbolKind.Method: return 'method';
			case vscode.SymbolKind.Property: return 'prop';
			case vscode.SymbolKind.Enum: return 'enum';
			case vscode.SymbolKind.Module: return 'module';
			case vscode.SymbolKind.Namespace: return 'namespace';
			case vscode.SymbolKind.TypeParameter: return 'type';
			default: return 'symbol';
		}
	}

	public async getImportRelationships(uri: vscode.Uri): Promise<Array<{importedFrom: string, symbols: string[]}>> {
		try {
			const document = await vscode.workspace.openTextDocument(uri);
			const fileContent = document.getText();
			const imports: Array<{importedFrom: string, symbols: string[]}> = [];
			const fileName = uri.path.toLowerCase();

			// JavaScript/TypeScript import patterns
			if (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || 
				fileName.endsWith('.js') || fileName.endsWith('.jsx') ||
				fileName.endsWith('.mts') || fileName.endsWith('.mjs') ||
				fileName.endsWith('.cts') || fileName.endsWith('.cjs')) {
				
				const jsImportPatterns = [
					// import { symbol1, symbol2 } from './module'
					/import\s*{\s*([^}]+)\s*}\s*from\s*['"`]([^'"`]+)['"`]/g,
					// import symbol from './module'
					/import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s*['"`]([^'"`]+)['"`]/g,
					// import * as symbol from './module'
					/import\s*\*\s*as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s*['"`]([^'"`]+)['"`]/g,
					// import './module' (bare import for CSS, side-effects)
					/import\s*['"`]([^'"`]+)['"`]/g,
					// Mixed imports: import symbol, { other } from './module'
					/import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*{\s*([^}]+)\s*}\s*from\s*['"`]([^'"`]+)['"`]/g,
					// import type { Type } from './module' (TypeScript)
					/import\s+type\s*{\s*([^}]+)\s*}\s*from\s*['"`]([^'"`]+)['"`]/g,
					// import type Symbol from './module' (TypeScript)
					/import\s+type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s*['"`]([^'"`]+)['"`]/g,
					// require('./module')
					/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
					// const { symbol } = require('./module')
					/const\s*{\s*([^}]+)\s*}\s*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
					// const symbol = require('./module')
					/const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
				];

				for (const pattern of jsImportPatterns) {
					let match;
					while ((match = pattern.exec(fileContent)) !== null) {
						let importPath: string;
						let symbols: string[];
						
						// Determine pattern type and extract accordingly
						if (pattern.source.includes('const\\s*{')) {
							// const { symbol } = require('./module') - symbols in match[1], path in match[2]
							importPath = match[2];
							symbols = match[1].split(',').map(s => s.trim());
						} else if (pattern.source.includes('const\\s+')) {
							// const symbol = require('./module') - symbol in match[1], path in match[2]
							importPath = match[2];
							symbols = [match[1]];
						} else if (pattern.source.includes('require') && match.length === 2) {
							// require('./module') - path is in match[1]
							importPath = match[1];
							symbols = ['*'];
						} else if (pattern.source.includes('import\\s*[\'"`]')) {
							// import './module' (bare import) - path is in match[1]
							importPath = match[1];
							symbols = ['*']; // Side-effect import
						} else if (pattern.source.includes('import\\s+type\\s*{')) {
							// import type { Type } from './module' - symbols in match[1], path in match[2]
							importPath = match[2];
							symbols = match[1].split(',').map(s => s.trim());
						} else if (pattern.source.includes('import\\s+type\\s+')) {
							// import type Symbol from './module' - symbol in match[1], path in match[2]
							importPath = match[2];
							symbols = [match[1]];
						} else if (match.length === 4) {
							// Mixed imports: import symbol, { other } from './module' - default in match[1], named in match[2], path in match[3]
							importPath = match[3];
							const defaultSymbol = match[1];
							const namedSymbols = match[2].split(',').map(s => s.trim());
							symbols = [defaultSymbol, ...namedSymbols];
						} else if (pattern.source.includes('\\*\\s*as')) {
							// import * as Name from './module' - symbol in match[1], path in match[2]
							importPath = match[2];
							symbols = [`* as ${match[1]}`];
						} else if (pattern.source.includes('{')) {
							// import { symbol1, symbol2 } from './module' - symbols in match[1], path in match[2]
							importPath = match[2];
							symbols = match[1].split(',').map(s => s.trim());
						} else if (match.length === 3) {
							// import defaultSymbol from './module' - symbol in match[1], path in match[2]
							importPath = match[2];
							symbols = [match[1]];
						} else {
							// Fallback
							continue;
						}
						
						// Only process relative imports (our project files)
						if (importPath && (importPath.startsWith('./') || importPath.startsWith('../'))) {
							const resolvedPath = this.resolveImportPath(uri, importPath);
							if (resolvedPath) {
								imports.push({
									importedFrom: resolvedPath,
									symbols: symbols
								});
							}
						}
					}
				}
			}

			// CSS @import patterns
			if (fileName.endsWith('.css') || fileName.endsWith('.scss') || 
				fileName.endsWith('.sass') || fileName.endsWith('.less')) {
				
				const cssImportPatterns = [
					/@import\s*['"`]([^'"`]+)['"`]/g,
					/@import\s*url\s*\(\s*['"`]?([^'"`\)]+)['"`]?\s*\)/g,
				];

				for (const pattern of cssImportPatterns) {
					let match;
					while ((match = pattern.exec(fileContent)) !== null) {
						const importPath = match[1];
						
						if (importPath.startsWith('./') || importPath.startsWith('../')) {
							const resolvedPath = this.resolveImportPath(uri, importPath);
							if (resolvedPath) {
								imports.push({
									importedFrom: resolvedPath,
									symbols: ['*']
								});
							}
						}
					}
				}
			}

			// HTML script/link references
			if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
				const htmlImportPatterns = [
					/<script[^>]+src\s*=\s*['"`]([^'"`]+)['"`]/g,
					/<link[^>]+href\s*=\s*['"`]([^'"`]+)['"`]/g,
				];

				for (const pattern of htmlImportPatterns) {
					let match;
					while ((match = pattern.exec(fileContent)) !== null) {
						const importPath = match[1];
						
						if (importPath.startsWith('./') || importPath.startsWith('../')) {
							const resolvedPath = this.resolveImportPath(uri, importPath);
							if (resolvedPath) {
								imports.push({
									importedFrom: resolvedPath,
									symbols: ['*']
								});
							}
						}
					}
				}
			}

			return imports;
		} catch (error) {
			console.error(`Error analyzing imports for ${uri.fsPath}:`, error);
			return [];
		}
	}

	private resolveImportPath(currentFile: vscode.Uri, importPath: string): string | null {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				return null;
			}

			const currentDir = currentFile.path.substring(0, currentFile.path.lastIndexOf('/'));
			let resolvedPath: string;

			if (importPath.startsWith('./')) {
				// Relative to current directory
				resolvedPath = currentDir + '/' + importPath.substring(2);
			} else if (importPath.startsWith('../')) {
				// Relative to parent directory
				const parts = currentDir.split('/');
				const importParts = importPath.split('/');
				
				let backCount = 0;
				for (const part of importParts) {
					if (part === '..') {
						backCount++;
					} else {
						break;
					}
				}

				const baseParts = parts.slice(0, parts.length - backCount);
				const remainingImportParts = importParts.slice(backCount);
				resolvedPath = baseParts.concat(remainingImportParts).join('/');
			} else {
				return null; // Not a relative import
			}

			// Try comprehensive file extensions for different languages
			const extensions = [
				// JavaScript/TypeScript
				'.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs',
				// Web technologies
				'.html', '.htm', '.css', '.scss', '.sass', '.less',
				// Python
				'.py', '.pyi', '.pyx',
				// Other common extensions (excluding json, yml, md per user request)
				'.xml'
			];

			// Try direct file with extensions
			for (const ext of extensions) {
				const fullPath = resolvedPath + ext;
				const relativePath = vscode.workspace.asRelativePath(vscode.Uri.file(fullPath));
				if (relativePath && !relativePath.startsWith('..')) {
					return relativePath;
				}
			}

			// Try index files
			for (const ext of extensions) {
				const indexPath = resolvedPath + '/index' + ext;
				const relativePath = vscode.workspace.asRelativePath(vscode.Uri.file(indexPath));
				if (relativePath && !relativePath.startsWith('..')) {
					return relativePath;
				}
			}

			// Try exact path (for files that might not need extensions)
			const exactPath = vscode.workspace.asRelativePath(vscode.Uri.file(resolvedPath));
			if (exactPath && !exactPath.startsWith('..')) {
				return exactPath;
			}

			return null;
		} catch (error) {
			return null;
		}
	}

	public async getFilesWithDependencies(): Promise<Array<{
		path: string, 
		symbols: Symbol[], 
		dependencies: Array<{importedFrom: string, symbols: string[]}>,
		linesOfCode: number
	}>> {
		const fileUris = await this.getWorkspaceFiles();
		const filesWithDependencies: Array<{
			path: string, 
			symbols: Symbol[], 
			dependencies: Array<{importedFrom: string, symbols: string[]}>,
			linesOfCode: number
		}> = [];

		for (const uri of fileUris) {
			const relativePath = vscode.workspace.asRelativePath(uri);
			const [symbols, dependencies, linesOfCode] = await Promise.all([
				this.getFileSymbols(uri),
				this.getImportRelationships(uri),
				this.getLinesOfCode(uri)
			]);

			filesWithDependencies.push({
				path: relativePath,
				symbols: symbols,
				dependencies: dependencies,
				linesOfCode: linesOfCode
			});
		}

		return filesWithDependencies.sort((a, b) => a.path.localeCompare(b.path));
	}

	private async getLinesOfCode(uri: vscode.Uri): Promise<number> {
		try {
			const document = await vscode.workspace.openTextDocument(uri);
			const content = document.getText();
			
			// Count non-empty, non-comment-only lines
			const lines = content.split('\n');
			let codeLines = 0;
			
			for (const line of lines) {
				const trimmedLine = line.trim();
				// Skip empty lines and comment-only lines
				if (trimmedLine.length > 0 && 
					!trimmedLine.startsWith('//') && 
					!trimmedLine.startsWith('/*') && 
					!trimmedLine.startsWith('*') &&
					trimmedLine !== '*/') {
					codeLines++;
				}
			}
			
			return codeLines;
		} catch (error) {
			console.error(`Error counting lines for ${uri.fsPath}:`, error);
			return 0;
		}
	}

	public async getGitChanges(): Promise<{
		addedFiles: Set<string>,
		removedFiles: Set<string>,
		modifiedFiles: Set<string>
	}> {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				return { addedFiles: new Set(), removedFiles: new Set(), modifiedFiles: new Set() };
			}

			// Get git status using VS Code's git API
			const gitExtension = vscode.extensions.getExtension('vscode.git');
			if (!gitExtension) {
				console.warn('Git extension not available');
				return { addedFiles: new Set(), removedFiles: new Set(), modifiedFiles: new Set() };
			}

			await gitExtension.activate();
			const git = gitExtension.exports.getAPI(1);
			const repository = git.repositories.find((repo: any) => 
				repo.rootUri.fsPath === workspaceFolder.uri.fsPath
			);

			if (!repository) {
				console.warn('No git repository found');
				return { addedFiles: new Set(), removedFiles: new Set(), modifiedFiles: new Set() };
			}

			const addedFiles = new Set<string>();
			const removedFiles = new Set<string>();
			const modifiedFiles = new Set<string>();

			// Get working tree changes
			for (const change of repository.state.workingTreeChanges) {
				const relativePath = vscode.workspace.asRelativePath(change.uri);
				
				switch (change.status) {
					case 0: // INDEX_MODIFIED
					case 1: // INDEX_ADDED
					case 2: // INDEX_DELETED
					case 3: // INDEX_RENAMED
					case 4: // INDEX_COPIED
						// These are staged changes, we can include them
						break;
					case 5: // MODIFIED
						modifiedFiles.add(relativePath);
						break;
					case 6: // DELETED
						removedFiles.add(relativePath);
						break;
					case 7: // UNTRACKED
						addedFiles.add(relativePath);
						break;
					case 8: // IGNORED
						// Skip ignored files
						break;
					default:
						modifiedFiles.add(relativePath);
						break;
				}
			}

			// Get index (staged) changes
			for (const change of repository.state.indexChanges) {
				const relativePath = vscode.workspace.asRelativePath(change.uri);
				
				switch (change.status) {
					case 0: // INDEX_MODIFIED
						modifiedFiles.add(relativePath);
						break;
					case 1: // INDEX_ADDED
						addedFiles.add(relativePath);
						break;
					case 2: // INDEX_DELETED
						removedFiles.add(relativePath);
						break;
					case 3: // INDEX_RENAMED
					case 4: // INDEX_COPIED
						modifiedFiles.add(relativePath);
						break;
					default:
						modifiedFiles.add(relativePath);
						break;
				}
			}

			return { addedFiles, removedFiles, modifiedFiles };
		} catch (error) {
			console.error('Error getting git changes:', error);
			return { addedFiles: new Set(), removedFiles: new Set(), modifiedFiles: new Set() };
		}
	}

	public async getFilesWithDependenciesAndGitStatus(): Promise<Array<{
		path: string, 
		symbols: Symbol[], 
		dependencies: Array<{importedFrom: string, symbols: string[]}>,
		linesOfCode: number,
		gitStatus: 'added' | 'removed' | 'modified' | 'unchanged'
	}>> {
		const [filesWithDependencies, gitChanges] = await Promise.all([
			this.getFilesWithDependencies(),
			this.getGitChanges()
		]);

		// Add git status to each file
		const filesWithGitStatus = filesWithDependencies.map(file => ({
			...file,
			gitStatus: this.getFileGitStatus(file.path, gitChanges) as 'added' | 'removed' | 'modified' | 'unchanged'
		}));

		// Add removed files that are no longer in the workspace
		for (const removedFile of gitChanges.removedFiles) {
			// Only add if it's not already in our list
			if (!filesWithGitStatus.some(f => f.path === removedFile)) {
				filesWithGitStatus.push({
					path: removedFile,
					symbols: [],
					dependencies: [],
					linesOfCode: 0,
					gitStatus: 'removed'
				});
			}
		}

		return filesWithGitStatus;
	}

	private getFileGitStatus(
		filePath: string, 
		gitChanges: { addedFiles: Set<string>, removedFiles: Set<string>, modifiedFiles: Set<string> }
	): string {
		if (gitChanges.addedFiles.has(filePath)) {
			return 'added';
		}
		if (gitChanges.removedFiles.has(filePath)) {
			return 'removed';
		}
		if (gitChanges.modifiedFiles.has(filePath)) {
			return 'modified';
		}
		return 'unchanged';
	}

	// Future method for detecting changes since last commit
	public async getChangedSymbols(): Promise<Array<{path: string, addedSymbols: Symbol[], removedSymbols: Symbol[]}>> {
		// This would compare current symbols with git HEAD to detect changes
		// For now, return empty array - we'll implement this later
		return [];
	}
}