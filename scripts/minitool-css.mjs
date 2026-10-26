import postcss from 'postcss';

// Local compatibility transforms for the features this game actually uses.
export function compatibleCSS(source) {
  const root = postcss.parse(source);
  root.walkRules(rule => {
    rule.selector = rule.selector.replaceAll(':has(.boss-status:not([hidden]))', '.has-boss')
      .replaceAll(':has(.spell-notice)', '.has-spell-notice')
      .replaceAll(':has(.battle-overlay:not(.hidden))', '.has-overlay');
    if (rule.selector.includes(':focus-visible')) rule.cloneBefore({ selector: rule.selector.replaceAll(':focus-visible', ':focus') });
  });
  root.walkAtRules('container', rule => {
    if (!/max-width:\s*350px/.test(rule.params)) throw new Error(`Unhandled container query: ${rule.params}`);
    rule.walkRules(child => { child.selectors = child.selectors.map(selector => `.arena-narrow ${selector}`); });
    rule.replaceWith(...rule.nodes);
  });
  root.walkDecls(decl => {
    if (decl.prop === 'container-type') { decl.remove(); return; }
    if (decl.prop === 'inset') {
      const [top, right = top, bottom = top, left = right] = postcss.list.space(decl.value);
      for (const [prop, value] of Object.entries({ top, right, bottom, left })) decl.cloneBefore({ prop, value });
      decl.remove(); return;
    }
    if (decl.prop === 'gap') {
      const [row, column = row] = postcss.list.space(decl.value);
      decl.cloneBefore({ prop: 'grid-gap' });
      decl.cloneBefore({ prop: '--layout-row-gap', value: row });
      decl.cloneBefore({ prop: '--layout-column-gap', value: column });
    }
    if (decl.prop === 'column-gap' || decl.prop === 'row-gap') {
      decl.cloneBefore({ prop: `grid-${decl.prop}` });
      decl.cloneBefore({ prop: `--layout-${decl.prop}` });
    }
    if (decl.prop === 'place-items') {
      const [align, justify = align] = postcss.list.space(decl.value);
      decl.cloneBefore({ prop: 'align-items', value: align });
      decl.cloneBefore({ prop: 'justify-items', value: justify });
    }
    if (decl.value.includes('dvh')) decl.value = decl.value.replaceAll('dvh', 'vh');
    if (decl.prop === 'backdrop-filter') decl.cloneBefore({ prop: '-webkit-backdrop-filter' });
    // var() can defer validation until computed-value time: isolate modern colors
    // so an unsupported function cannot invalidate a preceding baseline value.
    if (decl.value.includes('color-mix(') && !(decl.parent.parent.type === 'atrule' && decl.parent.parent.name === 'supports')) {
      const rule = decl.parent;
      const enhanced = postcss.atRule({ name: 'supports', params: '(color: color-mix(in srgb, red, blue))' });
      enhanced.append(postcss.rule({ selector: rule.selector }).append(decl.clone()));
      rule.after(enhanced);
      decl.remove();
    }
  });
  return root.toString();
}
