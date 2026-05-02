const axios = require('axios');
const crypto = require('crypto');

class ShopeeAPI {
  constructor() {
    this.appId  = process.env.SHOPEE_APP_ID;
    this.secret = process.env.SHOPEE_SECRET;
  }

  _extractIds(productLink) {
    try {
      const match = productLink.match(/product\/(\d+)\/(\d+)/);
      if (match) return { shopId: match[1], itemId: match[2] };
    } catch(e) {}
    return null;
  }

  async getProductImage(itemId, productLink) {
    const ids = this._extractIds(productLink || '');
    const shopId = ids?.shopId || '0';

    const urls = [
      `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`,
      `https://shopee.com.br/api/v2/item/get?itemid=${itemId}&shopid=${shopId}`,
    ];

    for (const url of urls) {
      try {
        const res = await axios.get(url, {
          timeout: 8000,
          headers: {
            'User-Agent':      'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Referer':         'https://shopee.com.br/',
            'Accept':          'application/json',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'X-API-SOURCE':    'pc',
            'X-Requested-With': 'XMLHttpRequest',
          }
        });

        const data = res.data?.data;
        if (!data) continue;

        const images = data.images || data.item_basic?.images || [];
        if (!images.length) continue;

        const imageUrl = `https://cf.shopee.com.br/file/${images[0]}`;
        console.log('[Shopee] Imagem encontrada:', imageUrl);
        return imageUrl;
      } catch(err) {
        console.warn('[Shopee] Tentativa falhou:', err.message);
      }
    }

    console.warn('[Shopee] Imagem não disponível para', itemId);
    return null;
  }

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
            'Content-Type':  'application/json',
            'Authorization': `SHA256 Credential=${this.appId},Timestamp=${timestamp},Signature=${signature}`,
          },
          timeout: 10000,
        }
      );

      const link = res.data?.data?.generateShortLink?.shortLink;
      return link || originalUrl;
    } catch (err) {
      console.warn('[Shopee] Erro link afiliado:', err.message);
      return originalUrl;
    }
  }
}

module.exports = { ShopeeAPI };
