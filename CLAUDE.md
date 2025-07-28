# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Vision

Planetarium is a VS Code extension that provides a live, interactive graph visualization of codebase architecture. The goal is to help developers (especially when working with AI coding agents) maintain a bird's-eye view of their project structure and understand how changes affect the overall architecture.

**License**: MIT License - Free and open source software

### Core Features ✅ **IMPLEMENTED**
1. ✅ **Live Architecture Graph**: Interactive D3.js visualization showing files as nodes with LOC metrics
2. ✅ **Dependency Mapping**: Visual connections between modules showing import relationships  
3. ✅ **Git Change Tracking**: Real-time highlighting of added/removed/modified files and dependencies
4. ✅ **Interactive Navigation**: Google Maps-style interface (pan with left-click, zoom with scroll)
5. ✅ **Jump to Definition**: Click on nodes to navigate to files in VS Code editor
6. ✅ **Multi-Language LSP Integration**: Support for 50+ file types via Language Server Protocol
7. ✅ **Smart Import Detection**: Comprehensive parsing of import patterns including TypeScript types
8. ✅ **Git-Aware Visualization**: Color-coded nodes and edges based on git working tree status

### Target Use Case
The extension is designed for developers working with AI coding agents who need to:
- Monitor how AI changes affect project architecture
- Quickly review architectural impact without reading every line of code  
- Maintain modularity and understand dependencies
- Get overview of large codebases during refactoring or onboarding
- Visualize git changes in architectural context

## Development Commands

### Build and Development
- `npm run compile` - Full build: type check, lint, and bundle
- `npm run watch` - Development mode with file watching (requires manual reload of Extension Development Host with Ctrl+R)
- `npm run package` - Production build for publishing
- `npm run check-types` - TypeScript type checking only
- `npm run lint` - ESLint checking for TypeScript files

### Testing
- `npm run test` - Run all tests (builds, compiles tests, lints, then runs vscode-test)
- `npm run compile-tests` - Compile test files to out/ directory
- `npm run pretest` - Preparation step that runs before tests

### Extension Development  
- Press F5 to launch Extension Development Host window
- Extension activates when `planetarium.openView` command is invoked (Ctrl+Shift+P → "Planetarium: Open View")
- After making changes, reload Extension Development Host with Ctrl+R (no hot reload available)
- Watch tasks run in background but require manual reload to see changes

## Technical Architecture

### Current Structure
- **Entry Point**: `src/extension.ts` - Simple activation/deactivation with command registration
- **Graph Models**: 
  - `src/graph/Node.ts` - FileNode class representing files with symbols, LOC, and git status
  - `src/graph/Graph.ts` - ProjectGraph class managing nodes and relationships with cumulative LOC calculation
- **Services**: `src/services/SymbolService.ts` - Multi-language LSP integration, git status, and comprehensive import parsing
- **UI Components**: `src/panels/PlanetariumPanel.ts` - Webview panel management and D3.js visualization with git-aware styling
- **Commands**: `planetarium.openView` (main command)

### Implementation Details ✅ **COMPLETED**
- ✅ **Graph Rendering**: D3.js-based SVG visualization in webview with pan/zoom controls
- ✅ **LSP Integration**: Multi-language support using VS Code's Language Server Protocol
- ✅ **Git Integration**: Real-time git status detection using VS Code's git API
- ✅ **Import Analysis**: Comprehensive parsing of JavaScript/TypeScript/CSS import patterns
- ✅ **Webview Communication**: Bidirectional communication between extension and graph UI

### Key Components Status
1. ✅ **Symbol Parser**: Multi-language LSP integration with export filtering for cleaner visualization
2. ✅ **Dependency Graph Builder**: Complete with cumulative LOC calculation and git status tracking
3. ✅ **Git Change Detector**: Real-time working tree change detection with color-coded visualization
4. ✅ **Graph Renderer**: D3.js force-directed layout with rectangular node intersection math
5. ✅ **Navigation Handler**: Click-to-navigate functionality for files and symbols
6. ✅ **Import Relationship Parser**: Advanced pattern matching for all import/require syntaxes
7. ✅ **Visual Git Integration**: Color-coded nodes, edges, and arrow heads based on git status

### Architecture Features
- **Multi-Language Support**: 50+ file types including JS/TS, Python, Java, C++, Go, Rust, CSS, HTML
- **Smart Import Detection**: Handles mixed imports, type imports, destructuring, CommonJS, ES6
- **Git-Aware Visualization**: Green for added, red for removed, yellow for modified
- **Rectangular Node Math**: Precise edge-to-border arrow positioning
- **Performance Optimized**: Efficient file discovery with proper gitignore support

### Build System
- Uses esbuild for fast bundling (configured in `esbuild.js`)
- TypeScript compilation with Node16 modules targeting ES2022
- Source maps enabled in development, minification in production
- Entry point: `src/extension.ts` → `dist/extension.js`

### Testing Setup
- Uses VS Code's built-in test framework (`@vscode/test-cli`)
- Test files in `src/test/` compiled to `out/test/`
- Configuration in `.vscode-test.mjs`

### Code Standards
- ESLint with TypeScript plugin
- Naming conventions: camelCase/PascalCase for imports
- Strict TypeScript configuration enabled