const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decodeEntities = value => value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (match, name) => {
  if (name[0] === '#') {
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  }
  return entities[name.toLowerCase()] ?? match;
});

export const isDescriptionHtml = (value = '') => /<\/?[a-z][^>]*>/i.test(String(value || ''));

function textParagraphs(value) {
  return String(value).replace(/\r\n?/g, '\n').split(/\n{2,}/).map(paragraph => paragraph.trim()).filter(Boolean)
    .map(paragraph => paragraph.split('\n').map(line => line.trim()));
}

// Rich descriptions are sanitized by the API; legacy plain text is returned as paragraphs for React to escape.
export function describeDescription(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (isDescriptionHtml(text)) return { kind: 'html', html: text };
  return { kind: 'text', paragraphs: textParagraphs(text) };
}

export function descriptionPlainText(value) {
  const text = String(value || '');
  if (!isDescriptionHtml(text)) return text.replace(/\s+/g, ' ').trim();
  return decodeEntities(text
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|br)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

export function descriptionMetaText(value, limit = 160) {
  const text = descriptionPlainText(value);
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > limit * 0.6 ? cut.slice(0, boundary) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}

export function descriptionToEditorHtml(value) {
  const text = String(value || '').trim();
  if (!text || isDescriptionHtml(text)) return text;
  return textParagraphs(text).map(lines => `<p>${lines.map(escapeHtml).join('<br>')}</p>`).join('');
}
