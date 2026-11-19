/**
 * MiniCompiler — Parser (Recursive Descent)
 * Phase 2: Converts token stream into an Abstract Syntax Tree (AST)
 *
 * Grammar (simplified):
 *   Program     → Statement*
 *   Statement   → VarDecl | FuncDecl | IfStmt | WhileStmt | ReturnStmt | ExprStmt | Block
 *   VarDecl     → Type IDENTIFIER ('=' Expr)? ';'
 *   FuncDecl    → 'func' Type IDENTIFIER '(' Params ')' Block
 *   IfStmt      → 'if' '(' Expr ')' Block ('else' (IfStmt | Block))?
 *   WhileStmt   → 'while' '(' Expr ')' Block
 *   ReturnStmt  → 'return' Expr? ';'
 *   Block       → '{' Statement* '}'
 *   Expr        → Assignment
 *   Assignment  → IDENTIFIER '=' Expr | LogicOr
 *   LogicOr     → LogicAnd ('||' LogicAnd)*
 *   LogicAnd    → Equality ('&&' Equality)*
 *   Equality    → Comparison (('=='|'!=') Comparison)*
 *   Comparison  → Addition (('<'|'>'|'<='|'>=') Addition)*
 *   Addition    → Multiplication (('+'|'-') Multiplication)*
 *   Multiplication → Unary (('*'|'/'|'%') Unary)*
 *   Unary       → ('!'|'-') Unary | Postfix
 *   Postfix     → Primary ('(' Args ')')?
 *   Primary     → NUMBER | STRING | BOOLEAN | IDENTIFIER | '(' Expr ')'
 */

'use strict';

// ── AST Node factory ────────────────────────────────────────
function node(type, props = {}) {
  return { nodeType: type, ...props };
}

// ═══════════════════════════════════════════════════════════
//  Parser class
// ═══════════════════════════════════════════════════════════
class Parser {
  constructor(tokens) {
    this.tokens  = tokens.filter(t => t.type !== TokenType.EOF).concat(tokens.filter(t => t.type === TokenType.EOF));
    this.pos     = 0;
    this.errors  = [];
  }

  // ── Navigation helpers ────────────────────────────────
  peek()    { return this.tokens[this.pos] || { type: TokenType.EOF, value: 'EOF' }; }
  prev()    { return this.tokens[this.pos - 1]; }
  isEOF()   { return this.peek().type === TokenType.EOF; }

  advance() {
    if (!this.isEOF()) this.pos++;
    return this.prev();
  }

  check(type, value) {
    if (this.isEOF()) return false;
    const tok = this.peek();
    return tok.type === type && (value === undefined || tok.value === value);
  }

  matchTok(type, value) {
    if (this.check(type, value)) { this.advance(); return true; }
    return false;
  }

  expect(type, value, msg) {
    if (this.check(type, value)) return this.advance();
    const tok = this.peek();
    this.errors.push({
      type: 'error',
      message: msg || `Expected ${value !== undefined ? `'${value}'` : type} but got '${tok.value}'`,
      line: tok.line, col: tok.col
    });
    return null;
  }

  synchronize() {
    this.advance();
    while (!this.isEOF()) {
      if (this.prev().value === ';') return;
      const v = this.peek().value;
      if (['if','while','func','int','float','bool','string','void','return'].includes(v)) return;
      this.advance();
    }
  }

  // ── TYPE names ─────────────────────────────────────────
  isType() {
    const v = this.peek().value;
    return this.peek().type === TokenType.KEYWORD && ['int','float','bool','string','void'].includes(v);
  }

  // ── Parsing Methods ────────────────────────────────────
  parse() {
    const stmts = [];
    while (!this.isEOF()) {
      try {
        stmts.push(this.parseStatement());
      } catch(e) {
        this.errors.push({ type: 'error', message: e.message, line: this.peek().line, col: this.peek().col });
        this.synchronize();
      }
    }
    return { ast: node('Program', { body: stmts }), errors: this.errors };
  }

  parseStatement() {
    const tok = this.peek();

    // Function declaration: func TYPE NAME(...)
    if (tok.type === TokenType.KEYWORD && tok.value === 'func') {
      return this.parseFuncDecl();
    }
    // Variable declaration: TYPE NAME ...
    if (this.isType()) {
      return this.parseVarDecl();
    }
    // If statement
    if (tok.type === TokenType.KEYWORD && tok.value === 'if') {
      return this.parseIfStmt();
    }
    // While statement
    if (tok.type === TokenType.KEYWORD && tok.value === 'while') {
      return this.parseWhileStmt();
    }
    // Return statement
    if (tok.type === TokenType.KEYWORD && tok.value === 'return') {
      return this.parseReturnStmt();
    }
    // Print statement (built-in)
    if (tok.type === TokenType.KEYWORD && tok.value === 'print') {
      return this.parsePrintStmt();
    }
    // Block
    if (tok.type === TokenType.DELIMITER && tok.value === '{') {
      return this.parseBlock();
    }
    // Expression statement
    return this.parseExprStmt();
  }

  parseFuncDecl() {
    const start = this.peek();
    this.expect(TokenType.KEYWORD, 'func');
    const retType = this.isType() ? this.advance().value : 'void';
    const name = this.expect(TokenType.IDENTIFIER, undefined, 'Expected function name');
    this.expect(TokenType.DELIMITER, '(', "Expected '(' after function name");
    const params = this.parseParams();
    this.expect(TokenType.DELIMITER, ')', "Expected ')' after parameters");
    const body = this.parseBlock();
    return node('Function', {
      name: name ? name.value : '?',
      returnType: retType,
      params,
      body,
      line: start.line, col: start.col
    });
  }

  parseParams() {
    const params = [];
    while (!this.check(TokenType.DELIMITER, ')') && !this.isEOF()) {
      const typeTok = this.isType() ? this.advance() : null;
      const nameTok = this.expect(TokenType.IDENTIFIER, undefined, 'Expected parameter name');
      if (nameTok) params.push(node('Param', { ptype: typeTok ? typeTok.value : 'auto', name: nameTok.value }));
      if (!this.matchTok(TokenType.DELIMITER, ',')) break;
    }
    return params;
  }

  parseVarDecl() {
    const typeTok = this.advance(); // consume type keyword
    const nameTok = this.expect(TokenType.IDENTIFIER, undefined, 'Expected variable name');
    let init = null;
    if (this.matchTok(TokenType.OPERATOR, '=')) {
      init = this.parseExpr();
    }
    this.expect(TokenType.DELIMITER, ';', "Expected ';' after variable declaration");
    return node('VarDecl', {
      varType: typeTok.value,
      name: nameTok ? nameTok.value : '?',
      init,
      line: typeTok.line, col: typeTok.col
    });
  }

  parseIfStmt() {
    const start = this.peek();
    this.expect(TokenType.KEYWORD, 'if');
    this.expect(TokenType.DELIMITER, '(', "Expected '(' after 'if'");
    const condition = this.parseExpr();
    this.expect(TokenType.DELIMITER, ')', "Expected ')' after if condition");
    const consequent = this.parseBlock();
    let alternate = null;
    if (this.matchTok(TokenType.KEYWORD, 'else')) {
      if (this.check(TokenType.KEYWORD, 'if')) alternate = this.parseIfStmt();
      else alternate = this.parseBlock();
    }
    return node('If', { condition, consequent, alternate, line: start.line, col: start.col });
  }

  parseWhileStmt() {
    const start = this.peek();
    this.expect(TokenType.KEYWORD, 'while');
    this.expect(TokenType.DELIMITER, '(', "Expected '(' after 'while'");
    const condition = this.parseExpr();
    this.expect(TokenType.DELIMITER, ')', "Expected ')' after while condition");
    const body = this.parseBlock();
    return node('While', { condition, body, line: start.line, col: start.col });
  }

  parseReturnStmt() {
    const start = this.peek();
    this.expect(TokenType.KEYWORD, 'return');
    let value = null;
    if (!this.check(TokenType.DELIMITER, ';')) {
      value = this.parseExpr();
    }
    this.expect(TokenType.DELIMITER, ';', "Expected ';' after return statement");
    return node('Return', { value, line: start.line, col: start.col });
  }

  parsePrintStmt() {
    const start = this.peek();
    this.expect(TokenType.KEYWORD, 'print');
    this.expect(TokenType.DELIMITER, '(', "Expected '(' after 'print'");
    const args = this.parseArgs();
    this.expect(TokenType.DELIMITER, ')', "Expected ')'");
    this.expect(TokenType.DELIMITER, ';', "Expected ';'");
    return node('Print', { args, line: start.line, col: start.col });
  }

  parseBlock() {
    const start = this.peek();
    this.expect(TokenType.DELIMITER, '{', "Expected '{' to begin block");
    const stmts = [];
    while (!this.check(TokenType.DELIMITER, '}') && !this.isEOF()) {
      try {
        stmts.push(this.parseStatement());
      } catch(e) {
        this.errors.push({ type: 'error', message: e.message, line: this.peek().line, col: this.peek().col });
        this.synchronize();
      }
    }
    this.expect(TokenType.DELIMITER, '}', "Expected '}' to close block");
    return node('Block', { body: stmts, line: start.line, col: start.col });
  }

  parseExprStmt() {
    const expr = this.parseExpr();
    this.expect(TokenType.DELIMITER, ';', "Expected ';' after expression");
    return node('ExprStmt', { expr, line: expr ? expr.line : 0 });
  }

  // ── Expression Parsing (Precedence Climbing) ──────────
  parseExpr()       { return this.parseAssignment(); }

  parseAssignment() {
    const left = this.parseLogicOr();
    const ops = ['=', '+=', '-=', '*=', '/='];
    if (left && left.nodeType === 'Identifier' && ops.includes(this.peek().value)) {
      const op = this.advance().value;
      const right = this.parseAssignment();
      if (op === '=') return node('Assign', { name: left.name, value: right, line: left.line, col: left.col });
      // Compound assignment: desugar x += y → x = x + y
      const binOp = op[0]; // first char is the operator
      return node('Assign', { name: left.name, value: node('BinOp', { op: binOp, left, right, line: left.line }), line: left.line, col: left.col });
    }
    return left;
  }

  parseBinary(parse, ops) {
    let left = parse.call(this);
    while (ops.includes(this.peek().value)) {
      const op = this.advance().value;
      const right = parse.call(this);
      left = node('BinOp', { op, left, right, line: left ? left.line : 0 });
    }
    return left;
  }

  parseLogicOr()      { return this.parseBinary(this.parseLogicAnd, ['||']); }
  parseLogicAnd()     { return this.parseBinary(this.parseEquality, ['&&']); }
  parseEquality()     { return this.parseBinary(this.parseComparison, ['==', '!=']); }
  parseComparison()   { return this.parseBinary(this.parseAddition, ['<', '>', '<=', '>=']); }
  parseAddition()     { return this.parseBinary(this.parseMultiplication, ['+', '-']); }
  parseMultiplication() { return this.parseBinary(this.parseUnary, ['*', '/', '%']); }

  parseUnary() {
    if (['!', '-'].includes(this.peek().value) && this.peek().type === TokenType.OPERATOR) {
      const op = this.advance();
      const operand = this.parseUnary();
      return node('UnaryOp', { op: op.value, operand, line: op.line, col: op.col });
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parsePrimary();
    // Function call
    while (this.check(TokenType.DELIMITER, '(')) {
      this.advance(); // consume '('
      const args = this.parseArgs();
      this.expect(TokenType.DELIMITER, ')', "Expected ')' after arguments");
      expr = node('Call', { callee: expr, args, line: expr ? expr.line : 0 });
    }
    // Post increment/decrement
    if (this.check(TokenType.OPERATOR, '++') || this.check(TokenType.OPERATOR, '--')) {
      const op = this.advance().value;
      expr = node('UnaryOp', { op: `post${op}`, operand: expr, line: expr ? expr.line : 0 });
    }
    return expr;
  }

  parseArgs() {
    const args = [];
    if (!this.check(TokenType.DELIMITER, ')')) {
      do { args.push(this.parseExpr()); }
      while (this.matchTok(TokenType.DELIMITER, ','));
    }
    return args;
  }

  parsePrimary() {
    const tok = this.peek();

    if (tok.type === TokenType.NUMBER) {
      this.advance();
      return node('Literal', { value: parseFloat(tok.value), litType: tok.value.includes('.') ? 'float' : 'int', line: tok.line, col: tok.col });
    }
    if (tok.type === TokenType.STRING) {
      this.advance();
      return node('Literal', { value: tok.value, litType: 'string', line: tok.line, col: tok.col });
    }
    if (tok.type === TokenType.BOOLEAN) {
      this.advance();
      return node('Literal', { value: tok.value === 'true', litType: 'bool', line: tok.line, col: tok.col });
    }
    if (tok.type === TokenType.IDENTIFIER) {
      this.advance();
      return node('Identifier', { name: tok.value, line: tok.line, col: tok.col });
    }
    if (tok.type === TokenType.DELIMITER && tok.value === '(') {
      this.advance(); // consume '('
      const expr = this.parseExpr();
      this.expect(TokenType.DELIMITER, ')', "Expected ')' after grouped expression");
      return expr;
    }

    if (!this.isEOF()) {
      this.errors.push({ type: 'error', message: `Unexpected token '${tok.value}'`, line: tok.line, col: tok.col });
      this.advance();
    }
    return null;
  }
}
