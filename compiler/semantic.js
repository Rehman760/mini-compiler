/**
 * MiniCompiler — Semantic Analyzer
 * Phase 3+4: Builds the symbol table and performs semantic checks
 *
 * Checks performed:
 *   ✓ Variable declared before use
 *   ✓ Variable redeclaration in same scope
 *   ✓ Type compatibility in assignments
 *   ✓ Function call argument count
 *   ✓ Return statement in non-void functions
 *   ✓ Undeclared function calls
 *   ✓ Type widening warnings (int → float)
 *   ✓ Division by zero (constant folding check)
 */

'use strict';

// ── Type system ────────────────────────────────────────────
const Types = { INT: 'int', FLOAT: 'float', BOOL: 'bool', STRING: 'string', VOID: 'void', AUTO: 'auto', UNKNOWN: 'unknown' };

function typeCompatible(declared, actual) {
  if (declared === Types.AUTO || actual === Types.UNKNOWN) return true;
  if (declared === actual) return true;
  if (declared === Types.FLOAT && actual === Types.INT) return true; // widening
  return false;
}

function inferType(node, scope) {
  if (!node) return Types.UNKNOWN;
  switch (node.nodeType) {
    case 'Literal':     return node.litType || Types.UNKNOWN;
    case 'Identifier': {
      const sym = scope.lookup(node.name);
      return sym ? sym.type : Types.UNKNOWN;
    }
    case 'BinOp': {
      const l = inferType(node.left, scope);
      const r = inferType(node.right, scope);
      if (['==','!=','<','>','<=','>=','&&','||'].includes(node.op)) return Types.BOOL;
      if (l === Types.FLOAT || r === Types.FLOAT) return Types.FLOAT;
      if (l === Types.STRING || r === Types.STRING) return Types.STRING;
      return l !== Types.UNKNOWN ? l : r;
    }
    case 'UnaryOp':
      if (node.op === '!') return Types.BOOL;
      return inferType(node.operand, scope);
    case 'Call': {
      const name = node.callee && node.callee.name;
      const fn = scope.lookup(name);
      return fn ? fn.returnType : Types.UNKNOWN;
    }
    default: return Types.UNKNOWN;
  }
}

// ═══════════════════════════════════════════════════════════
//  Scope (Symbol Table per scope level)
// ═══════════════════════════════════════════════════════════
class Scope {
  constructor(name = 'global', parent = null, kind = 'global') {
    this.name    = name;
    this.parent  = parent;
    this.kind    = kind; // 'global' | 'function' | 'block'
    this.symbols = new Map();
    this.children = [];
  }

  define(name, entry) {
    this.symbols.set(name, entry);
    return entry;
  }

  lookup(name) {
    if (this.symbols.has(name)) return this.symbols.get(name);
    if (this.parent) return this.parent.lookup(name);
    return null;
  }

  lookupLocal(name) {
    return this.symbols.get(name) || null;
  }

  toJSON() {
    return {
      name: this.name,
      kind: this.kind,
      symbols: [...this.symbols.entries()].map(([k, v]) => ({ name: k, ...v })),
      children: this.children.map(c => c.toJSON()),
    };
  }
}

// ═══════════════════════════════════════════════════════════
//  Semantic Analyzer
// ═══════════════════════════════════════════════════════════
class SemanticAnalyzer {
  constructor(ast) {
    this.ast     = ast;
    this.global  = new Scope('global', null, 'global');
    this.current = this.global;
    this.errors  = [];
    this.checks  = []; // individual check results for UI display
    this.currentFn = null;
  }

  // ── Utilities ─────────────────────────────────────────
  addError(msg, line) {
    this.errors.push({ type: 'error', message: msg, line });
    this.checks.push({ kind: 'fail', title: msg, detail: `Line ${line || '?'}`, line });
  }

  addWarn(msg, line) {
    this.errors.push({ type: 'warning', message: msg, line });
    this.checks.push({ kind: 'warn', title: msg, detail: `Line ${line || '?'}`, line });
  }

  addPass(msg, detail) {
    this.checks.push({ kind: 'pass', title: msg, detail });
  }

  enterScope(name, kind) {
    const child = new Scope(name, this.current, kind);
    this.current.children.push(child);
    this.current = child;
    return child;
  }

  exitScope() {
    this.current = this.current.parent;
  }

  // ── Analysis Entry ─────────────────────────────────────
  analyze() {
    if (!this.ast) return { scopes: this.global.toJSON(), errors: this.errors, checks: this.checks };
    this.visitProgram(this.ast);
    if (this.errors.filter(e => e.type === 'error').length === 0) {
      this.addPass('All semantic checks passed', 'No type errors, undeclared variables, or scope violations found.');
    }
    return {
      scopes: this.global.toJSON(),
      errors: this.errors,
      checks: this.checks,
    };
  }

  visitProgram(prog) {
    for (const stmt of (prog.body || [])) this.visitStmt(stmt);
  }

  visitStmt(stmt) {
    if (!stmt) return;
    switch (stmt.nodeType) {
      case 'VarDecl':   this.visitVarDecl(stmt); break;
      case 'Function':  this.visitFuncDecl(stmt); break;
      case 'If':        this.visitIf(stmt); break;
      case 'While':     this.visitWhile(stmt); break;
      case 'Return':    this.visitReturn(stmt); break;
      case 'Print':     this.visitPrint(stmt); break;
      case 'Block':     this.visitBlock(stmt, 'block'); break;
      case 'ExprStmt':  this.visitExpr(stmt.expr); break;
      case 'Assign':    this.visitAssign(stmt); break;
      default: break;
    }
  }

  visitVarDecl(stmt) {
    // Check redeclaration in same scope
    if (this.current.lookupLocal(stmt.name)) {
      this.addError(`Variable '${stmt.name}' already declared in this scope`, stmt.line);
    } else {
      let resolvedType = stmt.varType;
      if (stmt.init) {
        const initType = inferType(stmt.init, this.current);
        if (!typeCompatible(resolvedType, initType) && initType !== Types.UNKNOWN) {
          this.addError(`Type mismatch: cannot assign '${initType}' to '${resolvedType}' variable '${stmt.name}'`, stmt.line);
        } else if (resolvedType === Types.FLOAT && initType === Types.INT) {
          this.addWarn(`Implicit widening: int → float for '${stmt.name}'`, stmt.line);
        }
        this.visitExpr(stmt.init);
      }
      this.current.define(stmt.name, { type: resolvedType, kind: 'variable', line: stmt.line, initialized: stmt.init !== null });
      this.addPass(`Variable '${stmt.name}' declared`, `Type: ${resolvedType}, Line: ${stmt.line}`);
    }
  }

  visitFuncDecl(stmt) {
    if (this.current.lookupLocal(stmt.name)) {
      this.addError(`Function '${stmt.name}' already declared`, stmt.line);
    } else {
      this.current.define(stmt.name, {
        type: 'function',
        returnType: stmt.returnType,
        params: stmt.params.map(p => ({ name: p.name, type: p.ptype })),
        kind: 'function',
        line: stmt.line,
      });
      this.addPass(`Function '${stmt.name}' declared`, `Returns: ${stmt.returnType}, Params: ${stmt.params.length}`);
    }

    const prevFn = this.currentFn;
    this.currentFn = stmt;
    this.enterScope(stmt.name, 'function');

    // Add parameters to function scope
    for (const param of (stmt.params || [])) {
      this.current.define(param.name, { type: param.ptype, kind: 'parameter', line: stmt.line });
    }

    this.visitBlock(stmt.body, null); // block already entered inside
    this.exitScope();
    this.currentFn = prevFn;

    // Check return statement presence for non-void functions
    if (stmt.returnType !== 'void' && !this.hasReturn(stmt.body)) {
      this.addWarn(`Function '${stmt.name}' may not return a value on all paths`, stmt.line);
    }
  }

  hasReturn(block) {
    if (!block || !block.body) return false;
    return block.body.some(s => s && (s.nodeType === 'Return' || (s.nodeType === 'Block' && this.hasReturn(s))));
  }

  visitBlock(block, kind) {
    if (!block) return;
    const openScope = kind !== null;
    if (openScope) this.enterScope('block', kind || 'block');
    for (const stmt of (block.body || [])) this.visitStmt(stmt);
    if (openScope) this.exitScope();
  }

  visitIf(stmt) {
    this.visitExpr(stmt.condition);
    const condType = inferType(stmt.condition, this.current);
    if (condType !== Types.BOOL && condType !== Types.UNKNOWN) {
      this.addWarn(`If condition has type '${condType}', expected 'bool'`, stmt.line);
    }
    this.visitBlock(stmt.consequent, 'block');
    if (stmt.alternate) {
      if (stmt.alternate.nodeType === 'If') this.visitIf(stmt.alternate);
      else this.visitBlock(stmt.alternate, 'block');
    }
  }

  visitWhile(stmt) {
    this.visitExpr(stmt.condition);
    this.visitBlock(stmt.body, 'block');
  }

  visitReturn(stmt) {
    if (!this.currentFn) {
      this.addError(`'return' outside function`, stmt.line);
      return;
    }
    const retType = this.currentFn.returnType;
    if (stmt.value) {
      const valType = inferType(stmt.value, this.current);
      this.visitExpr(stmt.value);
      if (!typeCompatible(retType, valType) && valType !== Types.UNKNOWN) {
        this.addError(`Return type mismatch: expected '${retType}' but got '${valType}'`, stmt.line);
      }
    } else if (retType !== 'void') {
      this.addWarn(`Function '${this.currentFn.name}' returns void but expected '${retType}'`, stmt.line);
    }
  }

  visitPrint(stmt) {
    for (const arg of (stmt.args || [])) this.visitExpr(arg);
  }

  visitAssign(stmt) {
    const sym = this.current.lookup(stmt.name);
    if (!sym) {
      this.addError(`Undeclared variable '${stmt.name}'`, stmt.line);
    } else {
      const valType = inferType(stmt.value, this.current);
      if (!typeCompatible(sym.type, valType) && valType !== Types.UNKNOWN) {
        this.addError(`Cannot assign '${valType}' to '${sym.type}' variable '${stmt.name}'`, stmt.line);
      }
    }
    this.visitExpr(stmt.value);
  }

  visitExpr(expr) {
    if (!expr) return;
    switch (expr.nodeType) {
      case 'Identifier': {
        const sym = this.current.lookup(expr.name);
        if (!sym) this.addError(`Undeclared identifier '${expr.name}'`, expr.line);
        break;
      }
      case 'BinOp': {
        // Division by zero check
        if (expr.op === '/' && expr.right && expr.right.nodeType === 'Literal' && expr.right.value === 0) {
          this.addError(`Division by zero detected`, expr.line);
        }
        this.visitExpr(expr.left);
        this.visitExpr(expr.right);
        break;
      }
      case 'UnaryOp':  this.visitExpr(expr.operand); break;
      case 'Call': {
        const callee = expr.callee;
        if (callee && callee.nodeType === 'Identifier') {
          const sym = this.current.lookup(callee.name);
          if (!sym) {
            this.addError(`Undeclared function '${callee.name}'`, expr.line);
          } else if (sym.kind === 'function' && sym.params) {
            const expected = sym.params.length;
            const got = (expr.args || []).length;
            if (expected !== got) {
              this.addError(`Function '${callee.name}' expects ${expected} argument(s) but got ${got}`, expr.line);
            } else {
              this.addPass(`Call to '${callee.name}' is valid`, `${got} argument(s)`);
            }
          }
        }
        for (const arg of (expr.args || [])) this.visitExpr(arg);
        break;
      }
      case 'Assign':   this.visitAssign(expr); break;
      default: break;
    }
  }
}
