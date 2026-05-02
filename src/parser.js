// src/parser.js
function parseShopeeCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const split = (line) => {
    const result = []; let cur = ''; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = split(lines[0]).map(h => h.toLowerCase().trim());
  console.log('[Parser] Colunas:', headers.join(' | '));

  const products = [];
  lines.slice(1).forEach(line => {
    if (!line.trim()) return;
    const vals = split(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^"|"$/g, '').trim(); });

    const itemId    = row['item id'] || row['item_id'] || '';
    const name      = row['item name'] || row['item_name'] || '';
    const price     = row['price'] || '';
    const offerLink = row['offer link'] || row['offer_link'] || '';

    if (itemId && name && offerLink) {
      products.push({ item_id: itemId, name, price, offer_link: offerLink });
    }
  });

  console.log('[Parser] Produtos:', products.length);
  return products;
}

module.exports = { parseShopeeCSV };

