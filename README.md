# MiniCompiler — Interactive Compiler Construction Lab

An interactive browser-based compiler and visualization tool designed for teaching and learning compiler construction concepts.

## 🚀 Live Demo
Once deployed to GitHub Pages, the live demo will be accessible at:
`https://rehman760.github.io/mini-compiler/` (or your chosen repository name).

## ✨ Features
- **Phase 1: Lexical Analysis**: Interactive tokenization with token stream breakdown.
- **Phase 2: Syntax Analysis**: Recursive descent parsing producing an Abstract Syntax Tree (AST).
- **Phase 3 & 4: Semantic Analysis & Symbol Table**: Scope hierarchy, variable declarations, type checking, and warnings.
- **Phase 5: Intermediate Code Generation (IR)**: Three-Address Code (TAC), Quadruples, and AST-IR representation.
- **Visualizers**:
  - Interactive AST visualizer.
  - Control Flow Graph (CFG) basic blocks visualizer.
- **Reference Docs & Examples**: Built-in grammar documentation and preloaded example programs.

## 🛠️ Local Usage
Simply open `index.html` in any modern web browser or serve it with any local static server:
```bash
# Python 3
python -m http.server 8000

# Or Node npx serve
npx serve .
```

To run compiler tests in Node.js:
```bash
node test_compiler.js
```
