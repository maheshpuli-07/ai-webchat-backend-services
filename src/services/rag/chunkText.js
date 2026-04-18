/**
 * Split long text into overlapping chunks for embedding (FAQ / policy / product docs).
 * @param {string} text
 * @param {number} maxLen
 * @param {number} overlap
 * @returns {string[]}
 */
function chunkText(text, maxLen, overlap) {
  const t = String(text || '').trim();
  if (!t) return [];
  const paras = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  for (const p of paras) {
    if (p.length <= maxLen) {
      chunks.push(p);
      continue;
    }
    let i = 0;
    while (i < p.length) {
      const piece = p.slice(i, i + maxLen).trim();
      if (piece.length >= 20) {
        chunks.push(piece);
      }
      i += Math.max(1, maxLen - overlap);
    }
  }
  return chunks.filter((c) => c.length >= 20);
}

module.exports = { chunkText };
