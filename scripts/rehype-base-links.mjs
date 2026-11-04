/**
 * Додає base path (напр. /online-school) до внутрішніх посилань у Markdown,
 * щоб у статтях можна було писати просто [текст](/contacts/).
 */
export default function rehypeBaseLinks(base = '/') {
  const prefix = base.replace(/\/$/, '');
  const walk = (node) => {
    if (node.type === 'element' && node.tagName === 'a' && typeof node.properties?.href === 'string') {
      const href = node.properties.href;
      if (prefix && href.startsWith('/') && !href.startsWith('//') && !href.startsWith(`${prefix}/`)) {
        node.properties.href = prefix + href;
      }
    }
    if (node.children) node.children.forEach(walk);
  };
  return () => (tree) => walk(tree);
}
