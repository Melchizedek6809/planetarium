import * as vscode from 'vscode';

export class GitService {
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

	public getFileGitStatus(
		filePath: string, 
		gitChanges: { addedFiles: Set<string>, removedFiles: Set<string>, modifiedFiles: Set<string> }
	): 'added' | 'removed' | 'modified' | 'unchanged' {
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
}