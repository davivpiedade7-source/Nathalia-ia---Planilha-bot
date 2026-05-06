const axios = require('axios');
const crypto = require('crypto');

class ShopeeAPI {
  constructor() {
    this.appId   = String(process.env.SHOPEE_APP_ID || '').trim();
    this.secret  = String(process.env.SHOPEE_SECRET || '').trim();
    this.baseUrl = 'https://open-api.affiliate.shopee.com.br/graphql';
  }

  _sign(timestamp) {
    // Payload é: appId + timestamp (sem separador)
    const payload = this.appId + timestamp;
    console.log('[Shopee] Payload assinatura:', payload);
    return crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');
  }

  async _query(gql) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this._sign(timestamp);

    console.log('[Shopee] AppID usado:', this.appId);
    console.log('[Shopee] Secret (primeiros 5):', this.secret.substring(0, 5) + '...');
    console.log('[Shopee] Signature:', signature.substring(0, 20) + '...');

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
      console.error('[Shopee] Erro imagem:', err.response?.data ? JSON.stringify(err.response.data) : err.message);
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
