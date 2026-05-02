// src/shopee.js
// Busca imagem e preços do produto via API da Shopee

const axios = require('axios');
const crypto = require('crypto');

class ShopeeAPI {
  constructor() {
    this.appId  = process.env.SHOPEE_APP_ID;
    this.secret = process.env.SHOPEE_SECRET;
  }

  // Busca dados do produto pelo Item ID (API pública)
  async getProductData(itemId) {
    try {
      // Extrai shopId e itemId do product link se possível
      // formato: shopee.com.br/product/{shopId}/{itemId}
      const url = `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=0`;
      const res = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
          'Referer':    'https://shopee.com.br/',
          'Accept':     'application/json',
          'X-API-SOURCE': 'pc',
        }
      });

      const data = res.data?.data;
      if (!data) return null;

      // Imagem
      const images = data.images || [];
      const imageUrl = images.length > 0
        ? `https://cf.shopee.com.br/file/${images[0]}`
        : null;

      // Preços
      const priceMin    = data.price_min    ? (data.price_min / 100000).toFixed(2)    : null;
      const priceMax    = data.price_max    ? (data.price_max / 100000).toFixed(2)    : null;
      const priceOriginal = data.price      ? (data.price / 100000).toFixed(2)        : null;

      return { imageUrl, priceMin, priceMax, priceOriginal };
    } catch (err) {
      console.warn('[Shopee] Erro ao buscar produto:', err.message);
      return null;
    }
  }

  // Gera link de afiliado via API oficial
  async generateAffiliateLink(originalUrl) {
    if (!this.appId || !this.secret) return originalUrl;
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = crypto
        .createHmac('sha256', this.secret)
        .update(this.appId + timestamp)
        .digest('hex');

      const res = await axios.post(
        'https://open-api.affiliate.shopee.com.br/graphql',
        {
          query: `mutation {
            generateShortLink(input: {
              originUrl: "${originalUrl}"
              subIds: ["telegram_bot"]
            }) { shortLink }
          }`
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `SHA256 Credential=${this.appId},Timestamp=${timestamp},Signature=${signature}`,
          },
          timeout: 10000,
        }
      );

      const link = res.data?.data?.generateShortLink?.shortLink;
      return link || originalUrl;
    } catch (err) {
      console.warn('[Shopee] Erro ao gerar link afiliado:', err.message);
      return originalUrl;
    }
  }
}

module.exports = { ShopeeAPI };

