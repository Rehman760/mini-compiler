const fs = require('fs');
const vm = require('vm');

// Load all compiler modules into this context
vm.runInThisContext(fs.readFileSync('compiler/lexer.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('compiler/parser.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('compiler/semantic.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('compiler/irgen.js', 'utf8'));

const source = [
  'func int add(int a, int b) {',
  '  return a + b;',
  '}',
  '',
  'int x = 10;',
  'int y = 20;',
  'int z = add(x, y);',
  'float pi = 3.14;',
  'bool flag = true;',
  '',
  'if (z > 25) {',
  '  int result = z * 2;',
  '} else {',
  '  int result = z + 1;',
  '}',
  '',
  'int i = 0;',
  'while (i < 5) {',
  '  i = i + 1;',
  '}',
].join('\n');

// Phase 1: Lex
const lexer = new Lexer(source);
const { tokens, errors: lexErr } = lexer.tokenize();
console.log('PHASE 1 - Tokens:', tokens.filter(t=>t.type!=='EOF').length, 'tokens,', lexErr.length, 'lex errors');
tokens.filter(t=>t.type!=='EOF').slice(0,10).forEach(t => console.log('  ', t.type.padEnd(12), JSON.stringify(t.value)));

// Phase 2: Parse
const parser = new Parser(tokens);
const { ast, errors: parseErr } = parser.parse();
console.log('\nPHASE 2 - AST:', ast.nodeType, 'with', ast.body.length, 'top-level nodes,', parseErr.length, 'parse errors');
if (parseErr.length > 0) parseErr.forEach(e => console.error('  PARSE ERROR:', e.message, 'L'+e.line));

// Phase 3+4: Semantic
const analyzer = new SemanticAnalyzer(ast);
const { scopes, errors: semErr, checks } = analyzer.analyze();
console.log('\nPHASE 3+4 - Semantic:', checks.length, 'checks,', semErr.filter(e=>e.type==='error').length, 'errors,', semErr.filter(e=>e.type==='warning').length, 'warnings');
console.log('  Symbol table scopes:', scopes.name, '->', scopes.children.length, 'child scopes');
console.log('  Global symbols:', scopes.symbols.map(s=>s.name).join(', '));

// Phase 5: IR
const irgen = new IRGen(ast);
const { tac, cfg } = irgen.generate();
const realTAC = tac.filter(i=>i.kind!=='blank'&&i.kind!=='comment');
console.log('\nPHASE 5 - IR:');
console.log('  TAC instructions:', realTAC.length);
console.log('  CFG blocks:', cfg.blocks.length, ', edges:', cfg.edges.length);
console.log('\nSample TAC (first 20):');
realTAC.slice(0, 20).forEach(function(i) {
  switch(i.kind) {
    case 'func_begin': console.log('func ' + i.name + ' (' + i.returnType + ')'); break;
    case 'func_end': console.log('end ' + i.name); break;
    case 'copy':  console.log('  ' + i.dest + ' = ' + i.src); break;
    case 'binop': console.log('  ' + i.dest + ' = ' + i.left + ' ' + i.op + ' ' + i.right); break;
    case 'return': console.log('  return ' + (i.value||'')); break;
    case 'param_decl': console.log('  param ' + i.name + ' : ' + i.ptype); break;
    case 'if_false': console.log('  ifFalse ' + i.cond + ' -> ' + i.target); break;
    case 'label':  console.log(i.name + ':'); break;
    case 'goto':   console.log('  goto ' + i.target); break;
    case 'call':   console.log('  ' + (i.dest||'_') + ' = call ' + i.func); break;
    default: console.log(' [' + i.kind + ']');
  }
});

console.log('\nAll phases completed successfully!');
