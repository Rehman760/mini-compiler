/**
 * MiniCompiler — Lexer (Lexical Analyzer)
 * Phase 1: Converts source code text into a stream of tokens
 *
 * Supported token types:
 *   KEYWORD, IDENTIFIER, NUMBER, STRING, BOOLEAN, OPERATOR, DELIMITER, EOF
 *
 * MiniLang Grammar Terminals:
 *   Keywords:   int, float, bool, string, void, if, else, while, return, true, false, func
 *   Operators:  + - * / % = == != < > <= >= && || ! ++ --
 *   Delimiters: ( ) { } [ ] ; , .
 */

'use strict';

// ── Token Types ────────────────────────────────────────────
const TokenType = {
  KEYWORD:    'keyword',
  IDENTIFIER: 'identifier',
  NUMBER:     'number',
  STRING:     'string',
  BOOLEAN:    'boolean',
  OPERATOR:   'operator',
  DELIMITER:  'delimiter',
  EOF:        'EOF',
};

// ── Keywords set ───────────────────────────────────────────
const KEYWORDS = new Set([
  'int', 'float', 'bool', 'string', 'void',
  'if', 'else', 'while', 'for', 'return',
  'true', 'false', 'func', 'and', 'or', 'not',
  'print',
]);

// ── Single and multi-char operators ───────────────────────
const MULTI_OPS = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/='];
const SINGLE_OPS = new Set(['+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^']);
const DELIMITERS  = new Set(['(', ')', '{', '}', '[', ']', ';', ',', '.', ':']);

// ═══════════════════════════════════════════════════════════
//  Lexer class
// ═══════════════════════════════════════════════════════════
class Lexer {
  constructor(source) {
    this.source = source;
    this.pos    = 0;
    this.line   = 1;
    this.col    = 1;
    this.tokens = [];
    this.errors = [];
  }

  // ── Helpers ───────────────────────────────────────────
  peek(offset = 0) { return this.source[this.pos + offset] || ''; }

  advance() {
    const ch = this.source[this.pos++];
    if (ch === '\n') { this.line++; this.col = 1; }
    else { this.col++; }
    return ch;
  }

  match(expected) {
    if (this.source[this.pos] === expected) { this.advance(); return true; }
    return false;
  }

  skipWhitespace() {
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
      } else if (ch === '/' && this.peek(1) === '/') {
        // Single-line comment
        while (this.pos < this.source.length && this.peek() !== '\n') this.advance();
      } else if (ch === '/' && this.peek(1) === '*') {
        // Multi-line comment
        this.advance(); this.advance();
        while (this.pos < this.source.length) {
          if (this.peek() === '*' && this.peek(1) === '/') { this.advance(); this.advance(); break; }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  // ── Token Builders ─────────────────────────────────────
  makeToken(type, value, line, col) {
    return { type, value, line, col };
  }

  // ── Scan number literal ───────────────────────────────
  scanNumber(line, col) {
    let num = '';
    while (/[0-9]/.test(this.peek())) num += this.advance();
    if (this.peek() === '.' && /[0-9]/.test(this.peek(1))) {
      num += this.advance(); // consume '.'
      while (/[0-9]/.test(this.peek())) num += this.advance();
    }
    return this.makeToken(TokenType.NUMBER, num, line, col);
  }

  // ── Scan string literal ───────────────────────────────
  scanString(quote, line, col) {
    let str = '';
    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance(); // skip backslash
        const esc = this.advance();
        const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" };
        str += map[esc] || esc;
      } else {
        str += this.advance();
      }
    }
    if (this.peek() === quote) this.advance();
    else this.errors.push({ type: 'error', message: 'Unterminated string literal', line, col });
    return this.makeToken(TokenType.STRING, str, line, col);
  }

  // ── Scan identifier or keyword ─────────────────────────
  scanIdentifier(line, col) {
    let id = '';
    while (/[a-zA-Z0-9_]/.test(this.peek())) id += this.advance();
    if (id === 'true' || id === 'false') return this.makeToken(TokenType.BOOLEAN, id, line, col);
    if (KEYWORDS.has(id)) return this.makeToken(TokenType.KEYWORD, id, line, col);
    return this.makeToken(TokenType.IDENTIFIER, id, line, col);
  }

  // ── Main tokenize method ───────────────────────────────
  tokenize() {
    this.tokens = [];
    this.errors = [];

    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const line = this.line;
      const col  = this.col;
      const ch   = this.peek();

      // Number literal
      if (/[0-9]/.test(ch)) {
        this.tokens.push(this.scanNumber(line, col));
        continue;
      }

      // String literal
      if (ch === '"' || ch === "'") {
        this.advance(); // consume opening quote
        this.tokens.push(this.scanString(ch, line, col));
        continue;
      }

      // Identifier or keyword
      if (/[a-zA-Z_]/.test(ch)) {
        this.tokens.push(this.scanIdentifier(line, col));
        continue;
      }

      // Multi-char operators (check first)
      let found = false;
      for (const op of MULTI_OPS) {
        if (this.source.startsWith(op, this.pos)) {
          for (let i = 0; i < op.length; i++) this.advance();
          this.tokens.push(this.makeToken(TokenType.OPERATOR, op, line, col));
          found = true;
          break;
        }
      }
      if (found) continue;

      // Single-char operators
      if (SINGLE_OPS.has(ch)) {
        this.advance();
        this.tokens.push(this.makeToken(TokenType.OPERATOR, ch, line, col));
        continue;
      }

      // Delimiters
      if (DELIMITERS.has(ch)) {
        this.advance();
        this.tokens.push(this.makeToken(TokenType.DELIMITER, ch, line, col));
        continue;
      }

      // Unknown character
      this.errors.push({ type: 'warning', message: `Unexpected character '${ch}'`, line, col });
      this.advance();
    }

    this.tokens.push(this.makeToken(TokenType.EOF, 'EOF', this.line, this.col));
    return { tokens: this.tokens, errors: this.errors };
  }
}
