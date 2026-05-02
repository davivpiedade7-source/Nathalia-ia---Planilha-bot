const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

class BotDatabase {
  constructor() {
    this.db = new Database(path.join(DATA_DIR, 'bot.db'));
    this._init();
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id      TEXT NOT NULL UNIQUE,
        name         TEXT,
        price        TEXT,
        product_link TEXT,
        offer_link   TEXT,
        sent         INTEGER DEFAULT 0,
        added_at     TEXT DEFAULT (datetime('now','localtime'))
      );
    `);
  }

  addProduct(p) {
    this.db.prepare(`
      INSERT OR IGNORE INTO products (item_id, name, price, product_link, offer_link)
      VALUES (?, ?, ?, ?, ?)
    `).run(p.item_id, p.name, p.price, p.product_link || '', p.offer_link);
  }

  getNextProduct() {
    return this.db.prepare('SELECT * FROM products WHERE sent = 0 ORDER BY id ASC LIMIT 1').get();
  }

  markSent(itemId) {
    this.db.prepare('UPDATE products SET sent = 1 WHERE item_id = ?').run(itemId);
  }

  countAvailable() {
    return this.db.prepare('SELECT COUNT(*) as n FROM products WHERE sent = 0').get().n;
  }

  countTotal() {
    return this.db.prepare('SELECT COUNT(*) as n FROM products').get().n;
  }
}

module.exports = { BotDatabase };
