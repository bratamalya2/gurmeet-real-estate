import sanitizeHtml from 'sanitize-html';

export const MAX_DESCRIPTION_LENGTH = 20000;

const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const looksLikeHtml = value => /<\/?[a-z][^>]*>/i.test(value);
const safeHref = href => /^(https?:|mailto:|tel:)/i.test(String(href || '').replace(/[\u0000- ]/g, ''));

const options = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed', 'template'],
  // execCommand and pasted content produce b/i/div/h1 etc.; map them onto the allowlist instead of dropping their text.
  transformTags: {
    b: 'strong',
    i: 'em',
    div: 'p',
    h1: 'h2',
    h4: 'h3',
    h5: 'h3',
    h6: 'h3',
    // Links without a safe href are unwrapped to their text rather than kept as empty anchors.
    a: (tagName, attribs) => safeHref(attribs.href) ? { tagName, attribs: { href: attribs.href.trim(), target: '_blank', rel: 'noreferrer noopener' } } : { tagName: 'span', attribs: {} },
  },
  exclusiveFilter: frame => ['strong', 'em', 'u', 'h2', 'h3'].includes(frame.tag) && !frame.text.trim(),
};

export function plainTextToDescriptionHtml(value = '') {
  return String(value).replace(/\r\n?/g, '\n').split(/\n{2,}/).map(paragraph => paragraph.trim()).filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
}

export function sanitizeDescription(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text) return '';
  const html = looksLikeHtml(text) ? sanitizeHtml(text, options) : plainTextToDescriptionHtml(text);
  return html.replace(/<br\s*\/>/gi, '<br>').replace(/(<p><br><\/p>)+$/i, '').trim();
}

export function validateDescriptionLength(value) {
  return typeof value !== 'string' || value.length <= MAX_DESCRIPTION_LENGTH;
}
