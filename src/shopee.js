const axios = require('axios');
const crypto = require('crypto');

class ShopeeAPI {
  constructor() {
    this.appId   = process.env.SHOPEE_APP_ID;
    this.secret  = process.env.SHOPEE_SECRET;
    this.baseUrl = 'https://open-api.affiliate.shopee.com.br/graphql';
  }

  _sign(timestamp) {
    const payload = `${this.appId}${timestamp}`;
    return crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');
  }

  async _query(gql) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this._sign(timestamp);

    // Formato correto exigido pela Shopee
    const authHeader = `SHA256 Credential=${this.appId},Timestamp=${timestamp},Signature=${signature}`;

    console.log('[Shopee] AppID:', this.appId);
    console.log('[Shopee] Timestamp:', timestamp);
    console.log('[Shopee] Auth:', authHeader.substring(0, 60) + '...');

    const res = await axios.post(
      this.baseUrl,
      { query: gql },
      {
        headers: {
          'Content-Type':  'application/json',
          'Authorization': authHeader,
        },
        timeout: 10000,
      }
    );
    return res.data;
  }

  async getProductImage(itemId) {
    if (!itemId || !this.appId || !this.secret) {
      console.warn('[Shopee] Credenciais não configuradas');
      return null;
    }
    try {
      const gql = `{
        productOfferV2(itemId: ${itemId} limit: 1) {
          nodes { itemId imageUrl productName }
        }
      }`;
      const data = await this._query(gql);
      console.log('[Shopee] Resposta:', JSON.stringify(data).substring(0, 300));
      const nodes = data?.data?.productOfferV2?.nodes || [];
      return nodes[0]?.imageUrl || null;
    } catch (err) {
      console.error('[Shopee] Erro:', err.response?.data ? JSON.stringify(err.response.data) : err.message);
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
      console.log('[Shopee] Link gerado:', link || 'falhou, usando original');
      return link || originalUrl;
    } catch (err) {
      console.warn('[Shopee] Erro link:', err.response?.data ? JSON.stringify(err.response.data) : err.message);
      return originalUrl;
    }
  }
}

module.exports = { ShopeeAPI };
