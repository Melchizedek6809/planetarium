import * as vscode from 'vscode';

export class ImportParser {
	public async getImportRelationships(uri: vscode.Uri): Promise<Array<{importedFrom: string, symbols: string[]}>> {
		try {
			const imports: Array<{importedFrom: string, symbols: string[]}> = [];
			const fileName = uri.path.toLowerCase();
			
			if (this.isJavaScriptFile(fileName)) {
				await this.parseJavaScriptImportsLSP(uri, imports);
			} else if (this.isCSSFile(fileName)) {
				await this.parseCSSImportsLSP(uri, imports);
			} else if (this.isHTMLFile(fileName)) {
				await this.parseHTMLImportsLSP(uri, imports);
			}

			return imports;
		} catch (error) {
			console.error(`Error analyzing imports for ${uri.fsPath}:`, error);
			return [];
		}
	}

	private async parseJavaScriptImportsLSP(uri: vscode.Uri, imports: Array<{importedFrom: string, symbols: string[]}>) {
		try {
			// For JavaScript/TypeScript, we need to use a different approach
			// The document symbol provider + text analysis is more reliable for imports
			const document = await vscode.workspace.openTextDocument(uri);
			const fileContent = document.getText();
			
			// Simple but effective regex patterns for the most common import cases
			const importPatterns = [
				// import { symbol1, symbol2 } from './module'
				/import\s*{\s*([^}]+)\s*}\s*from\s*['"`]([^'"`]+)['"`]/g,
				// import symbol from './module'  
				/import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s*['"`]([^'"`]+)['"`]/g,
				// import * as symbol from './module'
				/import\s*\*\s*as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s*['"`]([^'"`]+)['"`]/g,
				// import './module' (side effects)
				/import\s*['"`]([^'"`]+)['"`]/g,
			];

			for (const pattern of importPatterns) {
				let match;
				while ((match = pattern.exec(fileContent)) !== null) {
					let importPath: string;
					let symbols: string[];
					
					if (pattern.source.includes('import\\s*[\'"`]')) {
						// Side effect import
						importPath = match[1];
						symbols = ['*'];
					} else if (pattern.source.includes('\\*\\s*as')) {
						// import * as Name
						importPath = match[2];
						symbols = [`* as ${match[1]}`];
					} else if (pattern.source.includes('{')) {
						// Named imports
						importPath = match[2];
						symbols = match[1].split(',').map(s => s.trim());
					} else {
						// Default import
						importPath = match[2];
						symbols = [match[1]];
					}
					
					if (this.isRelativeImport(importPath)) {
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
		} catch (error) {
			console.error('Error parsing JavaScript imports:', error);
		}
	}

	private async parseCSSImportsLSP(uri: vscode.Uri, imports: Array<{importedFrom: string, symbols: string[]}>) {
		try {
			// For CSS, try LSP document links first
			const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
				'vscode.executeLinkProvider',
				uri
			);

			if (links && links.length > 0) {
				for (const link of links) {
					if (link.target) {
						const relativePath = vscode.workspace.asRelativePath(link.target);
						if (relativePath && !relativePath.startsWith('..') && this.isCSSFile(relativePath)) {
							imports.push({
								importedFrom: relativePath,
								symbols: ['*']
							});
						}
					}
				}
			}
		} catch (error) {
			console.error('Error parsing CSS imports:', error);
		}
	}

	private async parseHTMLImportsLSP(uri: vscode.Uri, imports: Array<{importedFrom: string, symbols: string[]}>) {
		try {
			// For HTML, try LSP document links
			const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
				'vscode.executeLinkProvider',
				uri
			);

			if (links && links.length > 0) {
				for (const link of links) {
					if (link.target) {
						const relativePath = vscode.workspace.asRelativePath(link.target);
						if (relativePath && !relativePath.startsWith('..') && this.isProjectFile(relativePath)) {
							imports.push({
								importedFrom: relativePath,
								symbols: ['*']
							});
						}
					}
				}
			}
		} catch (error) {
			console.error('Error parsing HTML imports:', error);
		}
	}

	private isJavaScriptFile(fileName: string): boolean {
		return fileName.endsWith('.ts') || fileName.endsWith('.tsx') || 
			   fileName.endsWith('.js') || fileName.endsWith('.jsx') ||
			   fileName.endsWith('.mts') || fileName.endsWith('.mjs') ||
			   fileName.endsWith('.cts') || fileName.endsWith('.cjs');
	}

	private isCSSFile(fileName: string): boolean {
		return fileName.endsWith('.css') || fileName.endsWith('.scss') || 
			   fileName.endsWith('.sass') || fileName.endsWith('.less');
	}

	private isHTMLFile(fileName: string): boolean {
		return fileName.endsWith('.html') || fileName.endsWith('.htm');
	}

	private isRelativeImport(importPath: string): boolean {
		return importPath.startsWith('./') || importPath.startsWith('../');
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
				resolvedPath = currentDir + '/' + importPath.substring(2);
			} else if (importPath.startsWith('../')) {
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
				return null;
			}

			const extensions = [
				'.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs',
				'.html', '.htm', '.css', '.scss', '.sass', '.less',
				'.py', '.pyi', '.pyx',
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

			// Try exact path
			const exactPath = vscode.workspace.asRelativePath(vscode.Uri.file(resolvedPath));
			if (exactPath && !exactPath.startsWith('..')) {
				return exactPath;
			}

			return null;
		} catch (error) {
			return null;
		}
	}

	private isProjectFile(filePath: string): boolean {
		const extensions = [
			'.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs',
			'.html', '.htm', '.css', '.scss', '.sass', '.less',
			'.py', '.pyi', '.pyx',
			'.java', '.kt', '.kts', '.scala', '.sc',
			'.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hh', '.hxx',
			'.cs', '.csx',
			'.go',
			'.rs',
			'.php', '.phtml',
			'.rb', '.rbw',
			'.swift',
			'.dart',
			'.lua',
			'.sh', '.bash', '.zsh', '.fish',
			'.xml',
			'.sql', '.psql', '.mysql'
		];

		return extensions.some(ext => filePath.toLowerCase().endsWith(ext));
	}
}