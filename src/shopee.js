const axios = require('axios');
const crypto = require('crypto');

class ShopeeAPI {
  constructor() {
    this.appId   = String(process.env.SHOPEE_APP_ID || '').trim();
    this.secret  = String(process.env.SHOPEE_SECRET || '').trim();
    this.baseUrl = 'https://open-api.affiliate.shopee.com.br/graphql';
  }

  async _query(gql) {
    // Testa os dois formatos de timestamp
    const tsSeconds = Math.floor(Date.now() / 1000).toString();
    const tsMillis  = Date.now().toString();

    for (const timestamp of [tsSeconds, tsMillis]) {
      const signature = crypto
        .createHmac('sha256', this.secret)
        .update(this.appId + timestamp)
        .digest('hex');

      try {
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

        const data = res.data;
        if (!data.errors) {
          console.log('[Shopee] Autenticação ok com timestamp:', timestamp.length > 10 ? 'milissegundos' : 'segundos');
          return data;
        }
        console.warn('[Shopee] Erro com timestamp', timestamp.length > 10 ? 'ms' : 's', ':', data.errors[0]?.message);
      } catch(err) {
        console.warn('[Shopee] Erro HTTP:', err.message);
      }
    }
    return null;
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
      if (!data) return null;
      console.log('[Shopee] Resposta imagem:', JSON.stringify(data).substring(0, 200));
      const nodes = data?.data?.productOfferV2?.nodes || [];
      return nodes[0]?.imageUrl || null;
    } catch (err) {
      console.error('[Shopee] Erro imagem:', err.message);
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
      console.log('[Shopee] Link:', link || 'falhou');
      return link || originalUrl;
    } catch (err) {
      console.warn('[Shopee] Erro link:', err.message);
      return originalUrl;
    }
  }
}

module.exports = { ShopeeAPI };
