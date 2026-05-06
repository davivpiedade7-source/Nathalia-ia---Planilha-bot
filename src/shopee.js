const axios = require('axios');
const crypto = require('crypto');

class ShopeeAPI {
  constructor() {
    this.appId   = String(process.env.SHOPEE_APP_ID || '').trim();
    this.secret  = String(process.env.SHOPEE_SECRET || '').trim();
    this.baseUrl = 'https://open-api.affiliate.shopee.com.br/graphql';
  }

  async _query(gql) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload   = this.appId + timestamp;
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

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
    if (!this.appId || !this.secret) return null;
    try {
      const gql = `{
        productOfferV2(itemId: ${itemId} limit: 1) {
          nodes { itemId imageUrl }
        }
      }`;
      const data = await this._query(gql);
      console.log('[Shopee] Resposta:', JSON.stringify(data).substring(0, 300));
      const nodes = data?.data?.productOfferV2?.nodes || [];
      return nodes[0]?.imageUrl || null;
    } catch (err) {
      console.error('[Shopee] Erro:', err.message);
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
          }) { shortLink }
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
