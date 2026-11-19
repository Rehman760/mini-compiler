/**
 * MiniCompiler — Main Application (app.js)
 * Orchestrates the full compilation pipeline and drives the UI
 */

'use strict';

// ══════════════════════════════════════════════════════════
//  Example Programs
// ══════════════════════════════════════════════════════════
const EXAMPLES = {
  basic: {
    title: 'Basic Arithmetic',
    desc: 'Demonstrates variable declarations and arithmetic expressions',
    code: `// Basic Arithmetic — MiniLang
int x = 10;
int y = 20;
int z = x + y * 2;
float ratio = 3.14;
int result = z - x / 2;
`,
  },

  conditions: {
    title: 'If / Else Statements',
    desc: 'Demonstrates conditional branching with if-else',
    code: `// Conditionals — MiniLang
int score = 85;
int grade = 0;

if (score >= 90) {
  grade = 1;
} else if (score >= 70) {
  grade = 2;
} else {
  grade = 3;
}

bool passed = score >= 50;
`,
  },

  loops: {
    title: 'While Loop',
    desc: 'Demonstrates looping and accumulation',
    code: `// While Loop — MiniLang
int sum = 0;
int i = 1;
int n = 10;

while (i <= n) {
  sum = sum + i;
  i = i + 1;
}

int avg = sum / n;
`,
  },

  functions: {
    title: 'Functions',
    desc: 'Demonstrates function declarations and calls with parameters',
    code: `// Functions — MiniLang
func int add(int a, int b) {
  return a + b;
}

func int multiply(int x, int y) {
  return x * y;
}

func float average(int p, int q) {
  int s = add(p, q);
  return s / 2;
}

int r1 = add(5, 3);
int r2 = multiply(4, 6);
`,
  },

  complex: {
    title: 'Complex Program',
    desc: 'Combines functions, loops, conditionals, and multiple types',
    code: `// Complex Program — MiniLang
func int factorial(int n) {
  int result = 1;
  int i = 1;
  while (i <= n) {
    result = result * i;
    i = i + 1;
  }
  return result;
}

func bool isPrime(int n) {
  if (n <= 1) {
    return false;
  }
  int i = 2;
  while (i * i <= n) {
    int mod = n / i * i;
    if (mod == n) {
      return false;
    }
    i = i + 1;
  }
  return true;
}

int f5 = factorial(5);
int f7 = factorial(7);
bool p11 = isPrime(11);
`,
  },
};

// ══════════════════════════════════════════════════════════
//  State
// ══════════════════════════════════════════════════════════
const state = {
  compileResult: null,
  activePhase: 'tokens',
  activeIRTab: 'tac',
};

// ══════════════════════════════════════════════════════════
//  DOM References
// ══════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

const editor      = $('code-editor');
const lineNums    = $('line-numbers');
const lineCount   = $('line-count');
const charCount   = $('char-count');
const compileBtn  = $('compile-btn');
const clearBtn    = $('clear-btn');
const formatBtn   = $('format-btn');
const exampleSel  = $('example-select');
const errorPanel  = $('error-panel');
const errorList   = $('error-list');
const toast       = $('toast');
const phaseTabs   = document.querySelectorAll('.phase-tab');

// ══════════════════════════════════════════════════════════
//  Initialization
// ══════════════════════════════════════════════════════════
function init() {
  // Load default example
  editor.value = EXAMPLES.basic.code;
  updateEditorInfo();
  updateLineNumbers();

  // Event listeners
  editor.addEventListener('input', () => {
    updateEditorInfo();
    updateLineNumbers();
  });
  editor.addEventListener('scroll', syncLineNumberScroll);
  editor.addEventListener('keydown', handleEditorKeydown);

  compileBtn.addEventListener('click', runCompile);
  clearBtn.addEventListener('click', () => { editor.value = ''; updateEditorInfo(); updateLineNumbers(); });
  formatBtn.addEventListener('click', formatCode);

  exampleSel.addEventListener('change', () => {
    const ex = EXAMPLES[exampleSel.value];
    if (ex) { editor.value = ex.code; updateEditorInfo(); updateLineNumbers(); exampleSel.value = ''; }
  });

  // Phase tab switching
  phaseTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setActivePhase(tab.dataset.phase);
    });
  });

  // AST controls
  $('ast-expand-all').addEventListener('click', () => {
    ASTViz.expandAll($('ast-viz'));
    $('ast-expand-all').classList.add('active');
    $('ast-collapse-all').classList.remove('active');
  });
  $('ast-collapse-all').addEventListener('click', () => {
    ASTViz.collapseAll($('ast-viz'));
    $('ast-collapse-all').classList.add('active');
    $('ast-expand-all').classList.remove('active');
  });
  $('ast-show-types').addEventListener('change', (e) => {
    ASTViz.showTypes = e.target.checked;
    if (state.compileResult) {
      ASTViz.render(state.compileResult.ast, $('ast-viz'));
    }
  });

  // IR tabs
  document.querySelectorAll('.ir-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ir-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ir-view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      $(`ir-${tab.dataset.ir}`).classList.add('active');
    });
  });

  // Header nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      $('view-compiler').style.display = view === 'compiler' ? '' : 'none';
      $('view-docs').style.display = view === 'docs' ? '' : 'none';
      $('view-examples').style.display = view === 'examples' ? '' : 'none';
      if (view === 'docs') renderDocs();
      if (view === 'examples') renderExamples();
    });
  });

  // Auto-compile on load
  runCompile();
}

// ══════════════════════════════════════════════════════════
//  Editor Helpers
// ══════════════════════════════════════════════════════════
function updateEditorInfo() {
  const lines = editor.value.split('\n').length;
  lineCount.textContent = `Lines: ${lines}`;
  charCount.textContent = `Chars: ${editor.value.length}`;
}

function updateLineNumbers() {
  const lines = editor.value.split('\n').length;
  lineNums.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
}

function syncLineNumberScroll() {
  lineNums.scrollTop = editor.scrollTop;
}

function handleEditorKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end   = editor.selectionEnd;
    editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 2;
    updateEditorInfo();
    updateLineNumbers();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runCompile();
  }
}

function formatCode() {
  // Simple formatter: normalize indentation
  const lines = editor.value.split('\n');
  let indent = 0;
  const formatted = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('}')) indent = Math.max(0, indent - 1);
    const result = '  '.repeat(indent) + trimmed;
    if (trimmed.endsWith('{')) indent++;
    return result;
  });
  editor.value = formatted.join('\n');
  updateEditorInfo();
  updateLineNumbers();
  showToast('Code formatted', 'success');
}

// ══════════════════════════════════════════════════════════
//  Compilation Pipeline
// ══════════════════════════════════════════════════════════
function runCompile() {
  const source = editor.value.trim();
  if (!source) { showToast('Editor is empty!', 'error'); return; }

  compileBtn.classList.add('compiling');
  compileBtn.textContent = 'Compiling…';

  // Small delay for animation
  setTimeout(() => {
    try {
      const result = compile(source);
      state.compileResult = result;
      renderAll(result);

      const errCount = result.allErrors.filter(e => e.type === 'error').length;
      const warnCount = result.allErrors.filter(e => e.type === 'warning').length;
      if (errCount > 0) showToast(`Compiled with ${errCount} error(s)`, 'error');
      else if (warnCount > 0) showToast(`Compiled with ${warnCount} warning(s)`, 'success');
      else showToast('Compiled successfully ✓', 'success');
    } catch (e) {
      console.error(e);
      showToast('Internal compiler error: ' + e.message, 'error');
    }

    compileBtn.classList.remove('compiling');
    compileBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="none"><polygon points="5,3 18,10 5,17" fill="currentColor"/></svg> Compile';
  }, 200);
}

function compile(source) {
  const allErrors = [];

  // Phase 1: Lexical Analysis
  const lexer = new Lexer(source);
  const { tokens, errors: lexErrors } = lexer.tokenize();
  allErrors.push(...lexErrors);

  // Phase 2: Parsing (AST)
  const parser = new Parser(tokens);
  const { ast, errors: parseErrors } = parser.parse();
  allErrors.push(...parseErrors);

  // Phase 3+4: Semantic Analysis + Symbol Table
  const analyzer = new SemanticAnalyzer(ast);
  const { scopes, errors: semErrors, checks } = analyzer.analyze();
  allErrors.push(...semErrors);

  // Phase 5: IR Generation
  let tac = [], astIR = '', cfg = { blocks: [], edges: [] };
  if (parseErrors.filter(e => e.type === 'error').length === 0) {
    const irgen = new IRGen(ast);
    const irResult = irgen.generate();
    tac   = irResult.tac;
    astIR = astIR_stmt(ast, 0); // top-level AST IR
    cfg   = irResult.cfg;
  }

  return { tokens, ast, scopes, checks, tac, astIR, cfg, allErrors };
}

// ══════════════════════════════════════════════════════════
//  Rendering
// ══════════════════════════════════════════════════════════
function renderAll(result) {
  renderErrors(result.allErrors);
  renderTokens(result.tokens, result.allErrors);
  renderAST(result.ast, result.allErrors);
  renderSymbolTable(result.scopes, result.allErrors);
  renderSemantic(result.checks, result.allErrors);
  renderIR(result.tac, result.astIR, result.cfg, result.allErrors);
  updatePhaseStatuses(result.allErrors);
}

// ── Errors ──────────────────────────────────────────────
function renderErrors(errors) {
  const real = errors.filter(e => e.type === 'error' || e.type === 'warning');
  if (real.length === 0) {
    errorPanel.style.display = 'none';
    return;
  }
  errorPanel.style.display = '';
  errorList.innerHTML = real.map(e => `
    <div class="error-item ${e.type}">
      <span class="error-loc">${e.type === 'error' ? '✗' : '⚠'} L${e.line || '?'}</span>
      <span class="error-msg">${escHtml(e.message)}</span>
    </div>
  `).join('');
}

// ── Phase Status ─────────────────────────────────────────
function updatePhaseStatuses(errors) {
  const lexErr   = errors.filter(e => e._phase === 'lex' || e.type === 'warning');
  const parseErr = errors.filter(e => e.type === 'error');

  const setStatus = (id, cls) => {
    const el = $(id);
    if (el) { el.className = `phase-status ${cls}`; }
  };

  const hasErrors = errors.filter(e => e.type === 'error').length > 0;
  const hasWarns  = errors.filter(e => e.type === 'warning').length > 0;

  setStatus('status-tokens', 'ok');
  setStatus('status-ast',    hasErrors ? 'error' : 'ok');
  setStatus('status-symtable', hasErrors ? 'error' : 'ok');
  setStatus('status-semantic', hasErrors ? 'error' : hasWarns ? 'warn' : 'ok');
  setStatus('status-ir',     hasErrors ? 'error' : 'ok');
}

// ── Phase: Tokens ─────────────────────────────────────────
function renderTokens(tokens, errors) {
  const container = $('tokens-viz');
  const tableBody = $('token-table-body');
  const tableWrap = $('token-table-wrapper');

  const real = tokens.filter(t => t.type !== 'EOF');

  container.innerHTML = '';
  real.forEach((tok, i) => {
    const chip = document.createElement('span');
    chip.className = 'token-chip';
    chip.dataset.type = tok.type;
    chip.style.animationDelay = `${i * 15}ms`;
    chip.title = `Type: ${tok.type} | Line: ${tok.line} | Col: ${tok.col}`;
    chip.textContent = tok.value;
    container.appendChild(chip);
  });

  if (real.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">No tokens generated</div></div>';
  }

  // Fill table
  tableBody.innerHTML = real.map((tok, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><span class="token-chip" data-type="${tok.type}" style="font-size:0.7rem;padding:2px 7px">${tok.type}</span></td>
      <td>${escHtml(String(tok.value))}</td>
      <td>${tok.line}</td>
      <td>${tok.col}</td>
    </tr>
  `).join('');

  tableWrap.style.display = real.length > 0 ? '' : 'none';
}

// ── Phase: AST ────────────────────────────────────────────
function renderAST(ast, errors) {
  const container = $('ast-viz');
  if (!ast || errors.filter(e => e.type === 'error').length > 3) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Too many parse errors — fix source first</div></div>';
    return;
  }
  ASTViz.render(ast, container);
}

// ── Phase: Symbol Table ───────────────────────────────────
function renderSymbolTable(scopes, errors) {
  const container = $('symtable-viz');
  container.innerHTML = '';
  if (!scopes) return;

  renderScopeBlock(scopes, container, 0);
}

function renderScopeBlock(scope, container, delay) {
  const block = document.createElement('div');
  block.className = 'scope-block';
  block.style.animationDelay = `${delay}ms`;

  const kindClass = scope.kind === 'global' ? 'global' : scope.kind === 'function' ? 'function' : 'block';
  const kindLabel = scope.kind === 'global' ? 'Global' : scope.kind === 'function' ? 'Function' : 'Block';

  block.innerHTML = `
    <div class="scope-header">
      <span class="scope-badge ${kindClass}">${kindLabel}</span>
      <strong>${scope.name}</strong>
      <span class="scope-count">${scope.symbols.length} symbol(s)</span>
    </div>
    ${scope.symbols.length > 0 ? `
    <table class="sym-table">
      <thead><tr><th>Name</th><th>Type</th><th>Kind</th><th>Line</th><th>Info</th></tr></thead>
      <tbody>
        ${scope.symbols.map(sym => `
          <tr>
            <td class="sym-name">${escHtml(sym.name)}</td>
            <td class="sym-type">${sym.type}</td>
            <td>${sym.kind}</td>
            <td class="sym-line">${sym.line || '—'}</td>
            <td class="sym-val">${sym.returnType ? `returns: ${sym.returnType}` : sym.initialized === false ? 'uninitialized' : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : '<div style="padding:10px 14px;font-size:0.78rem;color:var(--text-muted)">(empty scope)</div>'}
  `;

  container.appendChild(block);

  // Render child scopes
  for (const child of (scope.children || [])) {
    renderScopeBlock(child, container, delay + 50);
  }
}

// ── Phase: Semantic ───────────────────────────────────────
function renderSemantic(checks, errors) {
  const container = $('semantic-viz');
  container.innerHTML = '';

  if (!checks || checks.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔬</div><div class="empty-text">No semantic checks recorded</div></div>';
    return;
  }

  // Summary row
  const errCount = checks.filter(c => c.kind === 'fail').length;
  const warnCount = checks.filter(c => c.kind === 'warn').length;
  const passCount = checks.filter(c => c.kind === 'pass').length;
  const summary = document.createElement('div');
  summary.className = `sem-summary ${errCount > 0 ? 'has-errors' : 'all-pass'}`;
  summary.style.animationDelay = '0ms';
  summary.innerHTML = errCount > 0
    ? `<span>⛔</span> ${errCount} error(s), ${warnCount} warning(s), ${passCount} passed`
    : `<span>✅</span> All ${passCount} semantic checks passed — ${warnCount} warning(s)`;
  container.appendChild(summary);

  checks.forEach((check, i) => {
    const el = document.createElement('div');
    el.className = `sem-check ${check.kind === 'fail' ? 'fail' : check.kind === 'warn' ? 'warn' : 'pass'}`;
    el.style.animationDelay = `${i * 40}ms`;
    el.innerHTML = `
      <span class="sem-icon">${check.kind === 'fail' ? '✗' : check.kind === 'warn' ? '⚠' : '✓'}</span>
      <div class="sem-body">
        <div class="sem-title">${escHtml(check.title)}</div>
        ${check.detail ? `<div class="sem-detail">${escHtml(check.detail)}</div>` : ''}
      </div>
      <span class="sem-badge">${check.kind === 'fail' ? 'error' : check.kind === 'warn' ? 'warn' : 'pass'}</span>
    `;
    container.appendChild(el);
  });
}

// ── Phase: IR ─────────────────────────────────────────────
function renderIR(tac, astIR, cfg, errors) {
  renderTAC(tac, errors);
  renderASTIR(astIR, errors);
  renderCFG(cfg, errors);
}

function renderTAC(tac, errors) {
  const container = $('ir-tac');
  if (!tac || tac.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">Cannot generate TAC — fix errors first</div></div>';
    return;
  }

  let lineNo = 1;
  const lines = tac.map(instr => {
    if (instr.kind === 'blank') return `<div style="height:8px"></div>`;
    if (instr.kind === 'comment') return `<div class="tac-line"><span class="tac-comment">; ${escHtml(instr.text)}</span></div>`;
    if (instr.kind === 'label') return `<div class="tac-line"><span class="tac-label">${escHtml(instr.name)}:</span></div>`;
    if (instr.kind === 'func_begin') return `
      <div style="height:8px"></div>
      <div class="tac-line"><span class="tac-kw">func</span> <span class="tac-var">${escHtml(instr.name)}</span><span class="tac-comment"> ; returns ${instr.returnType}</span></div>
    `;
    if (instr.kind === 'func_end') return `<div class="tac-line"><span class="tac-kw">end</span> <span class="tac-var">${escHtml(instr.name)}</span></div>`;

    const n = lineNo++;
    let content = '';
    switch (instr.kind) {
      case 'copy':
        content = `<span class="tac-var">${escHtml(instr.dest)}</span> <span class="tac-op">=</span> <span class="tac-lit">${escHtml(String(instr.src))}</span>`;
        break;
      case 'binop':
        content = `<span class="tac-var">${escHtml(instr.dest)}</span> <span class="tac-op">=</span> <span class="tac-var">${escHtml(instr.left)}</span> <span class="tac-op">${escHtml(instr.op)}</span> <span class="tac-var">${escHtml(instr.right)}</span>`;
        break;
      case 'unop':
        content = `<span class="tac-var">${escHtml(instr.dest)}</span> <span class="tac-op">=</span> <span class="tac-op">${escHtml(instr.op)}</span><span class="tac-var">${escHtml(instr.operand)}</span>`;
        break;
      case 'if_false':
        content = `<span class="tac-kw">ifFalse</span> <span class="tac-var">${escHtml(instr.cond)}</span> <span class="tac-kw">goto</span> <span class="tac-label">${escHtml(instr.target)}</span>`;
        break;
      case 'goto':
        content = `<span class="tac-kw">goto</span> <span class="tac-label">${escHtml(instr.target)}</span>`;
        break;
      case 'return':
        content = `<span class="tac-kw">return</span>${instr.value ? ` <span class="tac-var">${escHtml(instr.value)}</span>` : ''}`;
        break;
      case 'call':
        content = `${instr.dest ? `<span class="tac-var">${escHtml(instr.dest)}</span> <span class="tac-op">=</span> ` : ''}<span class="tac-kw">call</span> <span class="tac-var">${escHtml(instr.func)}</span>, <span class="tac-lit">${instr.args ? instr.args.length : 0}</span>`;
        break;
      case 'param':
        content = `<span class="tac-kw">param</span> <span class="tac-var">${escHtml(String(instr.value))}</span>`;
        break;
      case 'param_decl':
        content = `<span class="tac-kw">param</span> <span class="tac-var">${escHtml(instr.name)}</span> <span class="tac-comment">; type: ${instr.ptype}</span>`;
        break;
      default:
        content = `<span class="tac-comment">${escHtml(instr.kind)}</span>`;
    }
    return `<div class="tac-line" style="padding-left:16px"><span class="tac-lineno">${n}</span><span class="tac-instr">${content}</span></div>`;
  });

  container.innerHTML = `
    <div class="tac-output">
      <div class="tac-toolbar">
        <span>Three-Address Code — ${lineNo - 1} instructions</span>
        <button class="tac-copy" onclick="copyTAC()">Copy</button>
      </div>
      <div class="tac-code">${lines.join('')}</div>
    </div>
  `;
}

function copyTAC() {
  if (!state.compileResult) return;
  const lines = state.compileResult.tac
    .filter(i => i.kind !== 'blank')
    .map(i => {
      switch (i.kind) {
        case 'comment':   return `; ${i.text}`;
        case 'label':     return `${i.name}:`;
        case 'func_begin': return `\nfunc ${i.name} ; returns ${i.returnType}`;
        case 'func_end':  return `end ${i.name}`;
        case 'copy':      return `  ${i.dest} = ${i.src}`;
        case 'binop':     return `  ${i.dest} = ${i.left} ${i.op} ${i.right}`;
        case 'unop':      return `  ${i.dest} = ${i.op}${i.operand}`;
        case 'if_false':  return `  ifFalse ${i.cond} goto ${i.target}`;
        case 'goto':      return `  goto ${i.target}`;
        case 'return':    return `  return ${i.value || ''}`;
        case 'call':      return `  ${i.dest ? i.dest + ' = ' : ''}call ${i.func}, ${i.args ? i.args.length : 0}`;
        case 'param':     return `  param ${i.value}`;
        case 'param_decl': return `  param ${i.name} ; ${i.ptype}`;
        default: return `  ${i.kind}`;
      }
    }).join('\n');
  navigator.clipboard.writeText(lines).then(() => showToast('TAC copied!', 'success'));
}

function renderASTIR(astIR, errors) {
  const container = $('ir-ast-ir');
  if (!astIR) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔗</div><div class="empty-text">Cannot generate AST-IR — fix errors first</div></div>';
    return;
  }
  container.innerHTML = `<div class="astir-output">${escHtml(astIR)}</div>`;
}

function renderCFG(cfg, errors) {
  const container = $('ir-cfg');
  if (!cfg || cfg.blocks.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">Cannot generate CFG — fix errors first</div></div>';
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'cfg-container';
  CFGViz.render(cfg, wrap);
  container.innerHTML = '';
  container.appendChild(wrap);
}

// ══════════════════════════════════════════════════════════
//  Phase Navigation
// ══════════════════════════════════════════════════════════
function setActivePhase(phase) {
  state.activePhase = phase;
  phaseTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.phase === phase));
  document.querySelectorAll('.phase-content').forEach(el => el.classList.remove('active'));
  const target = $(`phase-${phase}`);
  if (target) target.classList.add('active');
}

// ══════════════════════════════════════════════════════════
//  Docs View
// ══════════════════════════════════════════════════════════
function renderDocs() {
  const container = $('docs-content');
  container.innerHTML = `
    <div class="doc-card">
      <h3>Variable Declarations</h3>
      <p>Declare variables with a type keyword followed by a name and optional initializer.</p>
      <pre>int x = 10;
float pi = 3.14;
bool flag = true;
string name = "hello";</pre>
    </div>
    <div class="doc-card">
      <h3>Arithmetic Operators</h3>
      <p>Standard arithmetic with correct precedence (PEMDAS).</p>
      <pre>int a = 5 + 3 * 2;   // 11
int b = (5 + 3) * 2; // 16
int c = 10 / 3;       // 3
int d = 10 % 3;       // 1</pre>
    </div>
    <div class="doc-card">
      <h3>Comparison &amp; Logic</h3>
      <p>Boolean expressions for conditions and assignments.</p>
      <pre>bool r1 = x == y;
bool r2 = x != y;
bool r3 = x >= 10 &amp;&amp; y &lt; 20;
bool r4 = !flag || r1;</pre>
    </div>
    <div class="doc-card">
      <h3>If / Else</h3>
      <p>Conditional branching with optional else-if chains.</p>
      <pre>if (x > 0) {
  // positive
} else if (x == 0) {
  // zero
} else {
  // negative
}</pre>
    </div>
    <div class="doc-card">
      <h3>While Loop</h3>
      <p>Repeat a block while a condition holds.</p>
      <pre>int i = 0;
while (i &lt; 10) {
  i = i + 1;
}</pre>
    </div>
    <div class="doc-card">
      <h3>Functions</h3>
      <p>Declare named functions with typed parameters and return type.</p>
      <pre>func int add(int a, int b) {
  return a + b;
}
int result = add(3, 4);</pre>
    </div>
    <div class="doc-card">
      <h3>Types</h3>
      <p>MiniLang supports four primitive types plus void for functions.</p>
      <pre>int    // 32-bit integer
float  // floating point
bool   // true / false
string // text literal
void   // function return only</pre>
    </div>
    <div class="doc-card">
      <h3>Comments</h3>
      <p>Use double-slash for line comments or /* */ for blocks.</p>
      <pre>// This is a line comment
/* This is a
   block comment */</pre>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════
//  Examples View
// ══════════════════════════════════════════════════════════
function renderExamples() {
  const container = $('examples-content');
  container.innerHTML = Object.entries(EXAMPLES).map(([key, ex]) => `
    <div class="example-card">
      <div class="example-card-header">
        <div>
          <h3>${ex.title}</h3>
          <div class="example-card-desc">${ex.desc}</div>
        </div>
        <button class="example-load-btn" onclick="loadExample('${key}')">Load & Compile</button>
      </div>
      <div class="example-code">${escHtml(ex.code.trim())}</div>
    </div>
  `).join('');
}

window.loadExample = function(key) {
  const ex = EXAMPLES[key];
  if (!ex) return;
  editor.value = ex.code;
  updateEditorInfo();
  updateLineNumbers();
  // Switch to compiler view
  document.querySelector('.nav-btn[data-view="compiler"]').click();
  setTimeout(runCompile, 100);
};

// ══════════════════════════════════════════════════════════
//  Toast Notifications
// ══════════════════════════════════════════════════════════
let toastTimer = null;
function showToast(message, type = '') {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

// ══════════════════════════════════════════════════════════
//  Utilities
// ══════════════════════════════════════════════════════════
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════════════════
//  Boot
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);
