const axios = require('axios');
const crypto = require('crypto');

class ShopeeAPI {
  constructor() {
    this.appId   = process.env.SHOPEE_APP_ID;
    this.secret  = process.env.SHOPEE_SECRET;
    this.baseUrl = 'https://open-api.affiliate.shopee.com.br/graphql';
  }

  _sign(timestamp) {
    return crypto
      .createHmac('sha256', this.secret)
      .update(this.appId + timestamp)
      .digest('hex');
  }

  async _query(gql) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this._sign(timestamp);
    const res = await axios.post(
      this.baseUrl,
      { query: gql },
      {
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `SHA256 Credential=${this.appId},Timestamp=${timestamp},Signature=${signature}`,
        },
        timeout: 10000,
      }
    );
    return res.data;
  }

  async getProductImage(itemId) {
    if (!itemId || !this.appId || !this.secret) return null;
    try {
      const gql = `{
        productOfferV2(
          itemId: ${itemId}
          limit: 1
        ) {
          nodes {
            itemId
            imageUrl
            productName
          }
        }
      }`;
      const data = await this._query(gql);
      console.log('[Shopee] Resposta completa:', JSON.stringify(data).substring(0, 500));
      const nodes = data?.data?.productOfferV2?.nodes || [];
      const imageUrl = nodes[0]?.imageUrl || null;
      if (imageUrl) console.log('[Shopee] Imagem:', imageUrl);
      else console.warn('[Shopee] Nenhum node retornado para itemId:', itemId);
      return imageUrl;
    } catch (err) {
      console.error('[Shopee] Erro completo:', err.response?.data || err.message);
      return null;
    }
  }

  async generateAffiliateLink(originalUrl) {
    if (!this.appId || !this.secret) return originalUrl;
    try {
      const gql = `
        mutation {
          generateShortLink(input: {
            originUrl: "${originalUrl}"
            subIds: ["telegram_bot"]
          }) {
            shortLink
          }
        }
      `;
      const data = await this._query(gql);
      const link = data?.data?.generateShortLink?.shortLink;
      return link || originalUrl;
    } catch (err) {
      console.warn('[Shopee] Erro link:', err.message);
      return originalUrl;
    }
  }
}

module.exports = { ShopeeAPI };
