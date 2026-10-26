// Localized pages only: translates interface text that tool scripts write at runtime
// (status lines, errors, generated labels) using the page's embedded phrase catalogue.
// The same rules as the build step apply: user content, inputs, code and anything
// marked translate="no" are never touched.
import { Translator, type Catalogue } from './phrases';

const data = document.getElementById('i18n-phrases');
if (data) {
  const { locale, prefix, prefixes, slugs, phrases } = JSON.parse(data.textContent || '{}') as {
    locale: string;
    prefix: string;
    prefixes: string[];
    slugs: Record<string, string>;
    phrases: Catalogue;
  };
  const t = new Translator(phrases);
  const ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt', 'aria-description'];
  // Elements in a fixed language (the language menu, Hindi labels) stay as written.
  const SKIP = 'script,style,code,pre,textarea,[translate="no"],[contenteditable],[lang]:not(html)';
  const ASSET = /^\/(_astro|brand|models|local-engine|font-index|pdf-assets|fonts|guide)\/|\.\w{2,5}$/;
  const skipped = (node: Node) => {
    const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
    return !element || Boolean(element.closest(SKIP));
  };
  const text = (node: Text) => {
    const value = node.data;
    if (!/\p{L}{2}/u.test(value) || skipped(node)) return;
    const translated = t.translateText(value);
    if (translated !== undefined && translated !== value) node.data = translated;
  };
  const localize = (href: string) => {
    if (!href.startsWith('/') || href.startsWith('//') || prefixes.includes(href.split('/')[1]) || ASSET.test(href.split(/[?#]/)[0]))
      return href;
    const [path, rest = ''] = href.split(/(?=[?#])/);
    const slug = path.replace(/^\/|\/$/g, '');
    return `/${prefix}/${slugs[slug] ? slugs[slug] + '/' : slug ? slug + '/' : ''}${rest}`;
  };
  const attributes = (element: Element) => {
    if (element.closest('[translate="no"],[lang]:not(html)')) return;
    for (const name of ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (!value || !/\p{L}{2}/u.test(value)) continue;
      const translated = t.translate(value.replace(/\s+/g, ' ').trim());
      if (translated !== undefined && translated !== value) element.setAttribute(name, translated);
    }
    if (element.tagName === 'A') {
      const href = element.getAttribute('href');
      if (href && !element.hasAttribute('download')) {
        const local = localize(href);
        if (local !== href) element.setAttribute('href', local);
      }
    }
  };
  const walk = (root: Node) => {
    if (root.nodeType === 3) return text(root as Text);
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      if (skipped(root)) return;
      attributes(root as Element);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.nodeType === 1 && (node as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode())
      if (node.nodeType === 3) text(node as Text);
      else attributes(node as Element);
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') text(record.target as Text);
      else if (record.type === 'attributes') attributes(record.target as Element);
      else record.addedNodes.forEach(walk);
    }
  });
  // Strings a script set before this ran (rare: modules run in document order).
  walk(document.body);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRIBUTES, 'href'],
  });
  document.documentElement.dataset.uiLanguage = locale;
}
