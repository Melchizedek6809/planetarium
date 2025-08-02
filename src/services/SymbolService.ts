import * as vscode from 'vscode';
import { Symbol } from '../graph/Node';
import { ImportParser } from './ImportParser';
import { GitService } from './GitService';

export class SymbolService {
	private importParser = new ImportParser();
	private gitService = new GitService();
	
	public async getWorkspaceFiles(): Promise<vscode.Uri[]> {
		if (!vscode.workspace.workspaceFolders) {
			return [];
		}

		const fileUris = await vscode.workspace.findFiles(
			'**/*.{' +
			'ts,js,tsx,jsx,mts,mjs,cts,cjs,' +
			'html,htm,css,scss,sass,less,' +
			'py,pyi,pyx,' +
			'java,kt,kts,scala,sc,' +
			'c,cpp,cc,cxx,h,hpp,hh,hxx,' +
			'cs,csx,' +
			'go,' +
			'rs,' +
			'php,phtml,' +
			'rb,rbw,' +
			'swift,' +
			'dart,' +
			'lua,' +
			'sh,bash,zsh,fish,' +
			'toml,xml,' +
			'tex,' +
			'sql,psql,mysql,' +
			'r,R,jl,elm,ex,exs,erl,hrl,hs,lhs,ml,mli,fs,fsi,fsx,fsscript,clj,cljs,cljc,edn' +
			'}',
			'{**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/target/**,**/.git/**,**/*.vsix,**/coverage/**,**/.nyc_output/**}'
		);

		return fileUris;
	}

	public async getFileSymbols(uri: vscode.Uri): Promise<Symbol[]> {
		try {
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
					const symbolText = fileContent.substring(
						document.offsetAt(symbol.range.start),
						document.offsetAt(symbol.range.end)
					);
					
					const lineStart = document.offsetAt(new vscode.Position(symbol.range.start.line, 0));
					const lineText = fileContent.substring(
						lineStart,
						document.offsetAt(symbol.range.end)
					);

					if (this.isExportedSymbol(lineText, symbol.name, fileContent)) {
						exportedSymbols.push({
							name: symbol.name,
							kind: this.getSymbolKindLabel(symbol.kind)
						});
					}
				}
			};

			extractExportedSymbols(symbols);
			return exportedSymbols.slice(0, 15);
		} catch (error) {
			console.error(`Error getting symbols for ${uri.fsPath}:`, error);
			return [];
		}
	}

	private isExportedSymbol(lineText: string, symbolName: string, fileContent: string): boolean {
		if (!this.isJavaScriptTypeFile(fileContent)) {
			return true;
		}

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

		for (const pattern of exportPatterns) {
			if (lowerLineText.includes(pattern.toLowerCase())) {
				return true;
			}
		}

		const exportRegex = new RegExp(`export\\s*{[^}]*\\b${symbolName}\\b[^}]*}`, 'i');
		if (exportRegex.test(fileContent)) {
			return true;
		}

		const defaultExportRegex = new RegExp(`export\\s+default\\s+${symbolName}`, 'i');
		if (defaultExportRegex.test(fileContent)) {
			return true;
		}

		return false;
	}

	private isJavaScriptTypeFile(fileContent: string): boolean {
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
		return this.importParser.getImportRelationships(uri);
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
			
			const lines = content.split('\n');
			let codeLines = 0;
			
			for (const line of lines) {
				const trimmedLine = line.trim();
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
		return this.gitService.getGitChanges();
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

		const filesWithGitStatus = filesWithDependencies.map(file => ({
			...file,
			gitStatus: this.gitService.getFileGitStatus(file.path, gitChanges) as 'added' | 'removed' | 'modified' | 'unchanged'
		}));

		for (const removedFile of gitChanges.removedFiles) {
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

	public async getChangedSymbols(): Promise<Array<{path: string, addedSymbols: Symbol[], removedSymbols: Symbol[]}>> {
		return [];
	}
}