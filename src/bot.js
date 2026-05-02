// src/bot.js
require('dotenv').config();

const TelegramBot        = require('node-telegram-bot-api');
const axios              = require('axios');
const { BotDatabase }    = require('./database');
const { parseShopeeCSV } = require('./parser');
const { ShopeeAPI }      = require('./shopee');
const { Scheduler }      = require('./scheduler');

const TOKEN     = process.env.TELEGRAM_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const ADMIN_ID  = process.env.ADMIN_TELEGRAM_ID;
const SCHEDULES = (process.env.SCHEDULES || '09:00,12:00,15:00,18:00,21:00').split(',');

const bot       = new TelegramBot(TOKEN, { polling: true });
const db        = new BotDatabase();
const shopee    = new ShopeeAPI();
const scheduler = new Scheduler();

function fmt(v) {
  return parseFloat(v).toFixed(2).replace('.', ',');
}

// ─── ENVIA PRÓXIMO PRODUTO ───────────────────────────────────────
async function sendNextProduct() {
  const product = db.getNextProduct();
  if (!product) {
    console.log('📭 Sem produtos na fila');
    return;
  }

  console.log('📦 Enviando:', product.name);

  // Busca dados na API da Shopee (imagem + preços)
  const data = await shopee.getProductData(product.item_id);

  // Monta o link de afiliado
  const affLink = await shopee.generateAffiliateLink(product.offer_link);

  // Monta o texto da mensagem
  const name = product.name.toUpperCase();

  let priceBlock = '';
  if (data?.priceOriginal && data?.priceMin && data.priceMin !== data.priceOriginal) {
    priceBlock = `🔥 R$${fmt(data.priceOriginal)} | R$${fmt(data.priceMin)}`;
  } else if (data?.priceMin) {
    priceBlock = `🔥 R$${fmt(data.priceMin)}`;
  } else if (product.price) {
    priceBlock = `🔥 R$${product.price}`;
  }

  const text = [
    `*${name}*`,
    '',
    priceBlock,
    '',
    `🔗 ${affLink}`,
  ].filter(Boolean).join('\n');

  try {
    if (data?.imageUrl) {
      await bot.sendPhoto(CHAT_ID, data.imageUrl, {
        caption: text,
        parse_mode: 'Markdown',
      });
    } else {
      await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
    }
    db.markSent(product.item_id);
    console.log('✅ Enviado:', product.name);
  } catch (err) {
    console.error('❌ Erro ao enviar:', err.message);
    // Fallback sem markdown
    try {
      await bot.sendMessage(CHAT_ID, text.replace(/\*/g, ''));
      db.markSent(product.item_id);
    } catch(e) { console.error('❌ Falha crítica:', e.message); }
  }
}

// ─── RECEBE PLANILHA CSV ─────────────────────────────────────────
bot.on('document', async (msg) => {
  if (ADMIN_ID && String(msg.from.id) !== ADMIN_ID) return;
  if (!msg.document.file_name.endsWith('.csv')) {
    bot.sendMessage(msg.chat.id, '⚠️ Envie um arquivo .csv da Shopee Affiliates.');
    return;
  }
  try {
    await bot.sendMessage(msg.chat.id, '📥 Processando planilha...');
    const file = await bot.getFile(msg.document.file_id);
    const url  = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
    const res  = await axios.get(url, { responseType: 'text' });
    const products = parseShopeeCSV(res.data);
    products.forEach(p => db.addProduct(p));
    await bot.sendMessage(msg.chat.id,
      `✅ Planilha importada!\n📦 ${db.countAvailable()} produtos na fila\n📊 ${db.countTotal()} total`
    );
  } catch (err) {
    await bot.sendMessage(msg.chat.id, `❌ Erro: ${err.message}`);
  }
});

// ─── COMANDOS ────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '👋 Olá! Sou o bot de promoções Shopee.\n\n' +
    '📎 Envie um arquivo .csv da Shopee Affiliates para carregar produtos.\n\n' +
    '/status — ver quantos produtos na fila\n' +
    '/enviar — enviar produto agora (teste)'
  );
});

bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📊 Na fila: ${db.countAvailable()}\n📦 Total: ${db.countTotal()}\n⏰ Horários: ${SCHEDULES.join(', ')}`
  );
});

bot.onText(/\/enviar/, async (msg) => {
  if (ADMIN_ID && String(msg.from.id) !== ADMIN_ID) return;
  await bot.sendMessage(msg.chat.id, '📤 Enviando produto agora...');
  await sendNextProduct();
});

// ─── INICIALIZAÇÃO ───────────────────────────────────────────────
async function main() {
  console.log('🛍️ Shopee Bot iniciado!');
  console.log('⏰ Horários:', SCHEDULES.join(', '));
  console.log('📦 Na fila:', db.countAvailable());

  if (!TOKEN || !CHAT_ID) {
    console.error('❌ TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID não configurados!');
    process.exit(1);
  }

  scheduler.registerDaily(SCHEDULES, sendNextProduct);

  try {
    await bot.sendMessage(CHAT_ID,
      `🤖 Bot iniciado!\n⏰ Horários: ${SCHEDULES.join(', ')}\n📦 Na fila: ${db.countAvailable()}`
    );
  } catch(e) { console.error('Erro msg inicial:', e.message); }

  console.log('✅ Aguardando horários...');
}

process.on('SIGINT', () => { scheduler.stopAll(); process.exit(0); });
main().catch(err => { console.error(err.message); process.exit(1); });

