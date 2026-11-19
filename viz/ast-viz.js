/**
 * MiniCompiler — AST Visualizer
 * Renders the AST as an interactive, collapsible tree in the DOM
 */

'use strict';

const ASTViz = {
  showTypes: true,

  render(ast, container) {
    container.innerHTML = '';
    if (!ast) return;
    const tree = document.createElement('div');
    tree.className = 'ast-tree';
    tree.appendChild(this.renderNode(ast, 0));
    container.appendChild(tree);
  },

  renderNode(node, depth) {
    if (!node) return document.createTextNode('');
    const wrapper = document.createElement('div');
    wrapper.className = 'ast-node';

    const header = document.createElement('div');
    header.className = 'ast-node-header';

    const hasChildren = this.getChildren(node).length > 0;
    const toggle = document.createElement('span');
    toggle.className = 'ast-toggle';
    toggle.textContent = hasChildren ? '▼' : ' ';
    header.appendChild(toggle);

    const typeEl = document.createElement('span');
    typeEl.className = `ast-node-type ${node.nodeType}`;
    typeEl.textContent = node.nodeType;
    header.appendChild(typeEl);

    // Inline value display
    const label = this.nodeLabel(node);
    if (label) {
      const val = document.createElement('span');
      val.className = 'ast-node-value';
      val.textContent = label;
      header.appendChild(val);
    }

    // Type tag
    if (this.showTypes) {
      const tag = this.nodeTag(node);
      if (tag) {
        const tagEl = document.createElement('span');
        tagEl.className = 'ast-node-tag';
        tagEl.textContent = tag;
        header.appendChild(tagEl);
      }
    }

    wrapper.appendChild(header);

    if (hasChildren) {
      const children = document.createElement('div');
      children.className = 'ast-children';
      for (const child of this.getChildren(node)) {
        if (child.isLeaf) {
          const leaf = document.createElement('div');
          leaf.className = 'ast-leaf';
          leaf.textContent = `• ${child.label}: ${child.value}`;
          children.appendChild(leaf);
        } else {
          children.appendChild(this.renderNode(child.node, depth + 1));
        }
      }
      wrapper.appendChild(children);

      header.addEventListener('click', () => {
        wrapper.classList.toggle('collapsed');
        toggle.textContent = wrapper.classList.contains('collapsed') ? '▶' : '▼';
      });
    }

    // Animate in
    wrapper.style.animationDelay = `${depth * 20}ms`;
    return wrapper;
  },

  nodeLabel(node) {
    switch (node.nodeType) {
      case 'Identifier': return `"${node.name}"`;
      case 'Literal':    return `${node.value}`;
      case 'BinOp':      return `op: "${node.op}"`;
      case 'UnaryOp':    return `op: "${node.op}"`;
      case 'VarDecl':    return `${node.name}`;
      case 'Function':   return `${node.name}`;
      case 'Assign':     return `→ ${node.name}`;
      case 'Call':       return node.callee ? node.callee.name : '';
      case 'Return':     return '';
      default: return '';
    }
  },

  nodeTag(node) {
    switch (node.nodeType) {
      case 'VarDecl':  return node.varType;
      case 'Function': return `${node.returnType} fn`;
      case 'Literal':  return node.litType;
      case 'Param':    return node.ptype;
      default: return '';
    }
  },

  getChildren(node) {
    const ch = [];
    const leaf = (label, value) => ({ isLeaf: true, label, value: String(value ?? '') });
    const child = (n) => ({ isLeaf: false, node: n });

    switch (node.nodeType) {
      case 'Program':
        for (const s of (node.body || [])) ch.push(child(s));
        break;
      case 'VarDecl':
        if (node.init) ch.push(child(node.init));
        break;
      case 'Function':
        for (const p of (node.params || [])) ch.push(child(p));
        if (node.body) ch.push(child(node.body));
        break;
      case 'Param':
        ch.push(leaf('name', node.name));
        ch.push(leaf('type', node.ptype));
        break;
      case 'Block':
        for (const s of (node.body || [])) ch.push(child(s));
        break;
      case 'If':
        if (node.condition) ch.push(child(node.condition));
        if (node.consequent) ch.push(child(node.consequent));
        if (node.alternate)  ch.push(child(node.alternate));
        break;
      case 'While':
        if (node.condition) ch.push(child(node.condition));
        if (node.body) ch.push(child(node.body));
        break;
      case 'Return':
        if (node.value) ch.push(child(node.value));
        break;
      case 'Print':
        for (const a of (node.args || [])) ch.push(child(a));
        break;
      case 'ExprStmt':
        if (node.expr) ch.push(child(node.expr));
        break;
      case 'BinOp':
        if (node.left)  ch.push(child(node.left));
        if (node.right) ch.push(child(node.right));
        break;
      case 'UnaryOp':
        if (node.operand) ch.push(child(node.operand));
        break;
      case 'Assign':
        if (node.value) ch.push(child(node.value));
        break;
      case 'Call':
        if (node.callee) ch.push(child(node.callee));
        for (const a of (node.args || [])) ch.push(child(a));
        break;
      default: break;
    }
    return ch;
  },

  expandAll(container) {
    container.querySelectorAll('.ast-node.collapsed').forEach(n => {
      n.classList.remove('collapsed');
      const toggle = n.querySelector('.ast-toggle');
      if (toggle) toggle.textContent = '▼';
    });
  },

  collapseAll(container) {
    container.querySelectorAll('.ast-node').forEach(n => {
      if (n.querySelector('.ast-children')) {
        n.classList.add('collapsed');
        const toggle = n.querySelector('.ast-toggle');
        if (toggle) toggle.textContent = '▶';
      }
    });
  },
};
