/**
 * MiniCompiler — CFG Visualizer
 * Renders Control Flow Graph as a visual block diagram
 */

'use strict';

const CFGViz = {
  render(cfg, container) {
    container.innerHTML = '';
    if (!cfg || !cfg.blocks || cfg.blocks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">No CFG data</div></div>';
      return;
    }

    // Group blocks by function (heuristic: func_* labels start new groups)
    const groups = [];
    let currentGroup = null;

    for (const block of cfg.blocks) {
      if (block.label === 'ENTRY' || block.label.startsWith('func_')) {
        currentGroup = { name: block.label, blocks: [] };
        groups.push(currentGroup);
      }
      if (currentGroup) currentGroup.blocks.push(block);
    }

    for (const group of groups) {
      const groupEl = document.createElement('div');
      groupEl.style.cssText = 'margin-bottom: 24px;';

      const title = document.createElement('div');
      title.style.cssText = 'font-size: 0.72rem; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; font-family: var(--font-code);';
      title.textContent = group.name === 'ENTRY' ? '▸ Global Scope' : `▸ ${group.name.replace('func_', 'function: ')}`;
      groupEl.appendChild(title);

      const flow = document.createElement('div');
      flow.className = 'cfg-flow';

      for (let i = 0; i < group.blocks.length; i++) {
        const block = group.blocks[i];
        const blockEl = this.renderBlock(block);
        flow.appendChild(blockEl);

        // Arrow between blocks
        if (i < group.blocks.length - 1) {
          const arrow = this.renderArrow(block, cfg);
          flow.appendChild(arrow);
        }
      }

      groupEl.appendChild(flow);
      container.appendChild(groupEl);
    }
  },

  renderBlock(block) {
    const el = document.createElement('div');
    el.className = 'cfg-block';
    el.style.animationDelay = `${Math.random() * 200}ms`;

    const label = document.createElement('div');
    label.className = 'cfg-block-label';
    label.textContent = block.label;
    el.appendChild(label);

    const instrs = document.createElement('div');
    instrs.className = 'cfg-block-instr';

    const meaningful = (block.instrs || []).filter(i =>
      i.kind !== 'blank' && i.kind !== 'comment' && i.kind !== 'func_begin' && i.kind !== 'func_end'
    );

    if (meaningful.length === 0) {
      instrs.textContent = '(empty block)';
      instrs.style.color = 'var(--text-muted)';
      instrs.style.fontStyle = 'italic';
    } else {
      for (const instr of meaningful.slice(0, 6)) {
        const line = document.createElement('div');
        line.style.fontFamily = 'var(--font-code)';
        line.style.fontSize = '0.72rem';
        line.style.lineHeight = '1.7';
        line.style.color = 'var(--text-secondary)';
        line.textContent = this.formatInstr(instr);
        instrs.appendChild(line);
      }
      if (meaningful.length > 6) {
        const more = document.createElement('div');
        more.style.color = 'var(--text-muted)';
        more.style.fontSize = '0.68rem';
        more.textContent = `  … ${meaningful.length - 6} more`;
        instrs.appendChild(more);
      }
    }

    el.appendChild(instrs);
    return el;
  },

  formatInstr(instr) {
    switch (instr.kind) {
      case 'copy':     return `${instr.dest} = ${instr.src}`;
      case 'binop':    return `${instr.dest} = ${instr.left} ${instr.op} ${instr.right}`;
      case 'unop':     return `${instr.dest} = ${instr.op}${instr.operand}`;
      case 'if_false': return `ifFalse ${instr.cond} → ${instr.target}`;
      case 'goto':     return `goto ${instr.target}`;
      case 'label':    return `${instr.name}:`;
      case 'return':   return `return ${instr.value || ''}`;
      case 'call':     return `${instr.dest ? instr.dest + ' = ' : ''}call ${instr.func}(${(instr.args||[]).join(', ')})`;
      case 'param':    return `param ${instr.value}`;
      case 'param_decl': return `param ${instr.ptype} ${instr.name}`;
      default: return `${instr.kind}`;
    }
  },

  renderArrow(block, cfg) {
    const arrow = document.createElement('div');
    arrow.className = 'cfg-arrow';
    arrow.style.cssText = 'padding: 6px 16px; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-muted);';

    // Find edges from this block
    const edges = (cfg.edges || []).filter(e => e.from === block.label);
    if (edges.length > 0) {
      const edgeLabel = edges[0].label;
      if (edgeLabel) {
        const span = document.createElement('span');
        span.className = 'cfg-edge-label';
        span.textContent = edgeLabel;
        arrow.appendChild(span);
      }
    }

    const downArrow = document.createElement('span');
    downArrow.textContent = '↓';
    arrow.appendChild(downArrow);
    return arrow;
  },
};
