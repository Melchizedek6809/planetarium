# Planetarium 🪐

**Step back and see your project from far away**

Planetarium is a VS Code extension that provides a live, interactive graph visualization of your codebase architecture. It shows the relationships between files and dependencies in a Google Maps-style interface that helps you maintain a bird's-eye view of your project structure.

**Free and Open Source** - Licensed under MIT License

## Overview

When working with AI coding agents, it's crucial to understand how code changes affect the overall architecture. Planetarium visualizes your codebase as an interactive graph where:

- **Files are nodes** showing their name, file type icon, and lines of code metrics
- **Connections show dependencies** between modules through import relationships
- **Git change tracking** highlights added/removed/modified files and dependencies with color coding
- **Interactive navigation** with Google Maps-style controls (left-click to pan, scroll to zoom)
- **Jump to definition** by clicking on nodes to open files in VS Code

## Features

### ✅ Live Architecture Visualization
- Real-time D3.js force-directed graph of your entire codebase structure
- Each file represented as a node with file type emoji icon and LOC metrics
- Visual connections (edges) showing import/dependency relationships between files
- Cumulative LOC display showing file size plus all direct dependencies

### ✅ Git Change Tracking
- **Color-coded nodes**: Green for added files, red for removed files, yellow for modified files
- **Color-coded edges**: Green arrows for new dependencies, red dashed arrows for removed dependencies
- **Color-coded arrow heads**: Match the git status of the dependency relationship
- Perfect for reviewing how AI agents have modified your architecture
- Real-time working tree status integration using VS Code's git API

### ✅ Interactive Navigation  
- Google Maps-style interface (pan with left-click, zoom with mouse wheel)
- Click on any node to jump directly to the file in VS Code
- Intuitive exploration of large codebases with pan/zoom controls
- Node opacity based on outgoing dependency count for visual hierarchy

### ✅ Comprehensive Language Support
- **50+ supported file types** via Language Server Protocol (LSP)
- **JavaScript/TypeScript**: Full ES6/CommonJS import support including type imports
- **Web Technologies**: CSS, SCSS, Sass, Less, HTML with @import and link detection
- **Programming Languages**: Python, Java, C++, Go, Rust, PHP, Ruby, Swift, and many more
- **Smart Import Detection**: Mixed imports, destructuring, type-only imports, bare imports

### ✅ Advanced Import Analysis
- Comprehensive regex pattern matching for all import syntaxes
- Support for `import`, `require`, `@import`, destructuring, type imports
- Relative path resolution with automatic file extension detection
- CSS import detection from JavaScript/TypeScript files

## Use Cases

- **AI-Assisted Development**: Monitor how coding agents affect your project's architecture in real-time
- **Code Review**: Quickly understand the scope and impact of changes with git-aware visualization
- **Architecture Planning**: Visualize dependencies to maintain modularity and identify coupling
- **Onboarding**: Help new team members understand codebase structure through interactive exploration
- **Refactoring**: Identify tightly coupled components and visualize architectural improvements
- **Multi-Language Projects**: Understand dependencies across JavaScript, TypeScript, CSS, and other languages

## Current Status

✅ **Fully Functional** - The extension is complete with all core features implemented:
- Multi-language LSP integration (50+ file types)
- Git-aware visualization with real-time change tracking
- Comprehensive import/dependency analysis  
- Interactive D3.js graph with navigation controls
- Advanced pattern matching for all import syntaxes

## Usage

1. Install the extension in VS Code
2. Open any workspace with code files
3. Run command: `Planetarium: Open View` (Ctrl+Shift+P)
4. Interact with the graph:
   - **Pan**: Left-click and drag
   - **Zoom**: Mouse wheel
   - **Navigate**: Click nodes to open files
   - **View Dependencies**: Follow arrows to see import relationships
   - **Git Status**: Colors show added (green), removed (red), modified (yellow) files

## Requirements

- VS Code 1.102.0 or higher
- Any supported language project (JavaScript, TypeScript, Python, Java, C++, Go, Rust, CSS, etc.)
- Git repository (optional, for change tracking features)

## Installation

Currently in development. Will be available on the VS Code Marketplace once ready.

## License

MIT License - Free and open source software

## Contributing

This project is complete and functional. Contributions and feedback are welcome for future enhancements!
