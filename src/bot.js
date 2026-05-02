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

async function sendNextProduct() {
  const product = db.getNextProduct();
  if (!product) { console.log('Sem produtos na fila'); return; }

  console.log('Enviando:', product.name);

  // Busca imagem usando item_id + product_link
  const imageUrl = await shopee.getProductImage(product.item_id, product.product_link);

  // Gera link de afiliado
  const affLink = await shopee.generateAffiliateLink(product.offer_link);

  // Monta mensagem
  const name = product.name.toUpperCase();
  const priceBlock = product.price ? `🔥 R$${product.price}` : '';

  const text = [
    `*${name}*`,
    '',
    priceBlock,
    '',
    `🔗 ${affLink}`,
  ].filter(Boolean).join('\n');

  try {
    if (imageUrl) {
      await bot.sendPhoto(CHAT_ID, imageUrl, {
        caption: text,
        parse_mode: 'Markdown',
      });
    } else {
      await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
    }
    db.markSent(product.item_id);
    console.log('Enviado:', product.name);
  } catch (err) {
    console.error('Erro ao enviar:', err.message);
    try {
      await bot.sendMessage(CHAT_ID, text.replace(/\*/g, ''));
      db.markSent(product.item_id);
    } catch(e) { console.error('Falha crítica:', e.message); }
  }
}

bot.on('document', async (msg) => {
  if (ADMIN_ID && String(msg.from.id) !== ADMIN_ID) return;
  if (!msg.document.file_name.endsWith('.csv')) {
    bot.sendMessage(msg.chat.id, 'Envie um arquivo .csv da Shopee Affiliates.');
    return;
  }
  try {
    await bot.sendMessage(msg.chat.id, 'Processando planilha...');
    const file = await bot.getFile(msg.document.file_id);
    const url  = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
    const res  = await axios.get(url, { responseType: 'text' });
    const products = parseShopeeCSV(res.data);
    products.forEach(p => db.addProduct(p));
    await bot.sendMessage(msg.chat.id,
      `Planilha importada!\n${db.countAvailable()} produtos na fila`
    );
  } catch (err) {
    await bot.sendMessage(msg.chat.id, `Erro: ${err.message}`);
  }
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    'Envie um .csv da Shopee Affiliates para carregar produtos.\n\n' +
    '/status — ver fila\n/enviar — enviar agora'
  );
});

bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `Na fila: ${db.countAvailable()}\nTotal: ${db.countTotal()}\nHorários: ${SCHEDULES.join(', ')}`
  );
});

bot.onText(/\/enviar/, async (msg) => {
  if (ADMIN_ID && String(msg.from.id) !== ADMIN_ID) return;
  await bot.sendMessage(msg.chat.id, 'Enviando produto agora...');
  await sendNextProduct();
});

async function main() {
  console.log('Bot iniciado!');
  if (!TOKEN || !CHAT_ID) { console.error('TOKEN ou CHAT_ID faltando!'); process.exit(1); }
  scheduler.registerDaily(SCHEDULES, sendNextProduct);
  try {
    await bot.sendMessage(CHAT_ID,
      `Bot iniciado!\nHorários: ${SCHEDULES.join(', ')}\nNa fila: ${db.countAvailable()}`
    );
  } catch(e) { console.error('Erro msg inicial:', e.message); }
  console.log('Aguardando...');
}

process.on('SIGINT', () => { scheduler.stopAll(); process.exit(0); });
main().catch(err => { console.error(err.message); process.exit(1); });
