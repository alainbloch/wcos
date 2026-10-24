import sanitizeHtml from 'sanitize-html';
export function sanitizeDefinition(value) {
  return sanitizeHtml(typeof value === 'string' ? value : '', {
    allowedTags: ['p','br','strong','b','em','i','u','ul','ol','li','a','blockquote','div','span'],
    allowedAttributes: { a: ['href','title','target','rel'] },
    allowedSchemes: ['http','https','mailto'],
    transformTags: { a: (tagName, attribs) => ({tagName, attribs: {...attribs, ...(attribs.target === '_blank' ? {rel:'noopener noreferrer'} : {})}}) },
  }).trim();
}
export const glossaryNameKey = name => name.trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
export function glossaryLetter(name) {
  const first = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : /^\d$/.test(first) ? '0-9' : 'Other';
}
