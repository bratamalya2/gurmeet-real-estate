'use client';

import { useEffect, useRef, useState } from 'react';
import { FiBold, FiItalic, FiLink, FiList, FiSlash, FiUnderline } from 'react-icons/fi';

const MAX_LENGTH = 20000;
const BLOCK_TAGS = { P: 'p', DIV: 'p', H1: 'h2', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3', UL: 'ul', OL: 'ol', LI: 'li' };
const INLINE_TAGS = { STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', U: 'u', BR: 'br', A: 'a' };
const DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK', 'IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'CANVAS', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM']);
const inactive = { bold: false, italic: false, underline: false, h2: false, h3: false, ul: false, ol: false, link: false };

const isEmptyHtml = html => !String(html || '').replace(/<br\s*\/?>|&nbsp;|<\/?(p|div|h2|h3|ul|ol|li|strong|em|u|b|i)[^>]*>/gi, '').trim();
const safeHref = href => /^(https?:|mailto:|tel:)/i.test(String(href || '').replace(/[\u0000- ]/g, ''));
const normalizeHref = value => {
  const href = String(value || '').trim();
  if (!href) return '';
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(href)) return `mailto:${href}`;
  if (!/^[a-z][a-z\d+.-]*:/i.test(href) && /^[\w-]+(\.[\w-]+)+/.test(href)) return `https://${href}`;
  return safeHref(href) ? href : '';
};
const queryState = command => { try { return document.queryCommandState(command); } catch { return false; } };
const queryBlock = () => { try { return String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''); } catch { return ''; } };

// Formatting hygiene only: the API sanitizes every description on write and on read.
function cleanPastedHtml(html) {
  const source = new DOMParser().parseFromString(html, 'text/html');
  const output = document.createElement('div');
  const copyChildren = (from, to) => {
    from.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) { to.append(document.createTextNode(node.textContent)); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.nodeName.toUpperCase();
      if (DROPPED_TAGS.has(tag)) return;
      const style = node.getAttribute('style') || '';
      // Google Docs wraps whole pastes in <b style="font-weight:normal">, and marks real bold/italic with span styles.
      let mapped = tag === 'B' && /font-weight\s*:\s*(normal|[1-5]00)\b/i.test(style) ? null : BLOCK_TAGS[tag] || INLINE_TAGS[tag];
      if (!mapped && tag === 'SPAN') mapped = /font-weight\s*:\s*(bold|[6-9]00)\b/i.test(style) ? 'strong' : /font-style\s*:\s*italic/i.test(style) ? 'em' : null;
      if (mapped === 'a' && !safeHref(node.getAttribute('href'))) mapped = null;
      if (!mapped) { copyChildren(node, to); return; }
      const element = document.createElement(mapped);
      if (mapped === 'a') element.setAttribute('href', node.getAttribute('href').trim());
      copyChildren(node, element);
      to.append(element);
    });
  };
  copyChildren(source.body, output);
  return output.innerHTML;
}

export default function RichTextEditor({ value = '', onChange, placeholder = '', label = 'Description' }) {
  const bodyRef = useRef(null);
  const authoredRef = useRef(null);
  const [active, setActive] = useState(inactive);
  const [hint, setHint] = useState('');
  const length = String(value || '').length;

  // React must never own the editable subtree, or the caret jumps on every keystroke.
  // Only write the DOM when the value changed from outside (loading another property, resetting the form).
  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    const incoming = value || '';
    if (incoming !== authoredRef.current && incoming !== node.innerHTML) node.innerHTML = incoming;
    authoredRef.current = incoming;
    node.dataset.empty = String(isEmptyHtml(node.innerHTML));
  }, [value]);

  useEffect(() => {
    let frame = 0;
    const onSelectionChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = bodyRef.current;
        const anchor = window.getSelection()?.anchorNode;
        if (!node || !anchor || !node.contains(anchor)) return;
        const block = queryBlock();
        const element = anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement;
        const next = { bold: queryState('bold'), italic: queryState('italic'), underline: queryState('underline'), h2: block === 'h2', h3: block === 'h3', ul: queryState('insertUnorderedList'), ol: queryState('insertOrderedList'), link: Boolean(element?.closest('a')) };
        setActive(current => Object.keys(next).some(key => current[key] !== next[key]) ? next : current);
      });
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => { document.removeEventListener('selectionchange', onSelectionChange); cancelAnimationFrame(frame); };
  }, []);

  function emit() {
    const node = bodyRef.current;
    if (!node) return;
    const html = node.innerHTML;
    const empty = isEmptyHtml(html);
    node.dataset.empty = String(empty);
    authoredRef.current = empty ? '' : html;
    if (hint) setHint('');
    onChange?.(empty ? '' : html);
  }

  function exec(command, argument) {
    bodyRef.current?.focus();
    try { document.execCommand(command, false, argument); } catch {}
    emit();
    document.dispatchEvent(new Event('selectionchange'));
  }

  function prepare() {
    try { document.execCommand('styleWithCSS', false, false); } catch {}
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
  }

  function toggleBlock(tag) { exec('formatBlock', queryBlock() === tag ? '<p>' : `<${tag}>`); }

  function editLink() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !bodyRef.current?.contains(selection.anchorNode)) return;
    const anchorNode = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
    const existing = anchorNode?.closest('a');
    if (existing && selection.isCollapsed) {
      const whole = document.createRange();
      whole.selectNodeContents(existing);
      selection.removeAllRanges();
      selection.addRange(whole);
    }
    if (selection.isCollapsed) { setHint('Select the text you want to turn into a link.'); return; }
    const range = selection.getRangeAt(0).cloneRange();
    const entered = window.prompt('Link address (https://…, email, or phone). Leave empty to remove the link.', existing?.getAttribute('href') || 'https://');
    if (entered === null) return;
    selection.removeAllRanges();
    selection.addRange(range);
    if (!entered.trim()) { exec('unlink'); return; }
    const href = /^\+?[\d\s().-]{7,}$/.test(entered.trim()) ? `tel:${entered.replace(/[^\d+]/g, '')}` : normalizeHref(entered);
    if (!href) { setHint('Links must start with https://, http://, mailto:, or tel:.'); return; }
    setHint('');
    exec('createLink', href);
  }

  function clearFormatting() {
    if (queryState('insertUnorderedList')) exec('insertUnorderedList');
    if (queryState('insertOrderedList')) exec('insertOrderedList');
    exec('unlink');
    exec('removeFormat');
    exec('formatBlock', '<p>');
  }

  function onKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); editLink(); }
  }

  function onPaste(event) {
    event.preventDefault();
    const html = event.clipboardData?.getData('text/html');
    const text = event.clipboardData?.getData('text/plain') || '';
    const cleaned = html ? cleanPastedHtml(html) : '';
    if (cleaned && !isEmptyHtml(cleaned)) exec('insertHTML', cleaned);
    else if (text) exec('insertText', text);
  }

  const tools = [
    { key: 'bold', label: 'Bold (Ctrl+B)', icon: <FiBold />, run: () => exec('bold') },
    { key: 'italic', label: 'Italic (Ctrl+I)', icon: <FiItalic />, run: () => exec('italic') },
    { key: 'underline', label: 'Underline (Ctrl+U)', icon: <FiUnderline />, run: () => exec('underline') },
    'divider',
    { key: 'h2', label: 'Heading', icon: <span className="rich-text-glyph">H2</span>, run: () => toggleBlock('h2') },
    { key: 'h3', label: 'Subheading', icon: <span className="rich-text-glyph">H3</span>, run: () => toggleBlock('h3') },
    'divider',
    { key: 'ul', label: 'Bulleted list', icon: <FiList />, run: () => exec('insertUnorderedList') },
    { key: 'ol', label: 'Numbered list', icon: <span className="rich-text-glyph">1.</span>, run: () => exec('insertOrderedList') },
    'divider',
    { key: 'link', label: 'Link (Ctrl+K)', icon: <FiLink />, run: editLink },
    { key: 'clear', label: 'Clear formatting', icon: <FiSlash />, run: clearFormatting },
  ];

  return <div className="rich-text-editor">
    <div className="rich-text-toolbar" role="toolbar" aria-label={`${label} formatting`}>
      {tools.map((tool, index) => tool === 'divider'
        ? <span key={`divider-${index}`} className="rich-text-divider" aria-hidden="true" />
        : <button key={tool.key} type="button" title={tool.label} aria-label={tool.label} aria-pressed={tool.key in active ? active[tool.key] : undefined} onMouseDown={event => event.preventDefault()} onClick={tool.run}>{tool.icon}</button>)}
    </div>
    <div
      ref={bodyRef}
      className="rich-text-surface"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      data-placeholder={placeholder}
      onFocus={prepare}
      onInput={emit}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
    {(hint || length > MAX_LENGTH * 0.9) && <p className={length > MAX_LENGTH ? 'rich-text-hint is-over' : 'rich-text-hint'} role="status">{hint || `${length.toLocaleString('en-US')} / ${MAX_LENGTH.toLocaleString('en-US')} characters of formatted text`}</p>}
  </div>;
}
