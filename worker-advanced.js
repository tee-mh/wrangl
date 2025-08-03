// Cloudflare Worker: Multi-site Property Scraper (Rightmove, Zoopla, OnTheMarket)
// Paste into your Worker project (e.g., index.js)
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const searchUrl = url.searchParams.get('target');
    if (!searchUrl) {
      return new Response('Missing ?target=...', { status: 400 });
    }

    // Identify site
    let site = '';
    if (searchUrl.includes('rightmove.co.uk')) site = 'rightmove';
    else if (searchUrl.includes('zoopla.co.uk')) site = 'zoopla';
    else if (searchUrl.includes('onthemarket.com')) site = 'otm';
    else return new Response('Unsupported site', { status: 400 });

    const resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cloudflare-Worker/1.0; +https://workers.cloudflare.com/)',
        'Accept': 'text/html'
      }
    });
    const html = await resp.text();
    let results = [];

    if (site === 'rightmove') {
      // --- Rightmove parsing ---
      const cardRegex = /<div[^>]+class="propertyCard[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="propertyCard|<\/main>)/g;
      let cardMatch;
      while ((cardMatch = cardRegex.exec(html)) !== null) {
        const cardHtml = cardMatch[1];
        const urlMatch = cardHtml.match(/<a[^>]+class="propertyCard-link"[^>]+href="([^"]+)"/);
        const url = urlMatch ? 'https://www.rightmove.co.uk' + urlMatch[1] : null;
        const priceMatch = cardHtml.match(/<span[^>]+class="propertyCard-priceValue"[^>]*>([^<]+)<\/span>/);
        const priceStr = priceMatch ? priceMatch[1].replace(/[^\d]/g, '') : null;
        const price = priceStr ? parseInt(priceStr, 10) : null;
        const titleMatch = cardHtml.match(/<h2[^>]+class="propertyCard-title"[^>]*>([^<]+)<\/h2>/);
        const title = titleMatch ? titleMatch[1].trim() : null;
        const addrMatch = cardHtml.match(/<address[^>]*>([^<]+)<\/address>/);
        const address = addrMatch ? addrMatch[1].trim() : null;
        const imgMatch = cardHtml.match(/<img[^>]+class="propertyCard-img"[^>]+src="([^"]+)"/);
        const imgUrl = imgMatch ? imgMatch[1] : null;
        let bedrooms = null;
        const bedsMatch = title && title.match(/(\d+)\s*bed/i);
        if (bedsMatch) bedrooms = parseInt(bedsMatch[1], 10);
        let bathrooms = null;
        const bathMatch = cardHtml.match(/(\d+)\s*bath/i);
        if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);
        let type = null;
        if (/semi[- ]?detached/i.test(title)) type = 'semi-detached';
        else if (/detached/i.test(title)) type = 'detached';
        else type = 'other';
        if (url && price) {
          results.push({
            url, price, title, address, image: imgUrl, bedrooms, bathrooms, type, source: 'Rightmove'
          });
        }
      }
    } else if (site === 'zoopla') {
      // --- Zoopla parsing ---
      const cardRegex = /<div[^>]+data-testid="search-result"[^>]*>([\s\S]*?)(?=<div[^>]+data-testid="search-result|<\/main>)/g;
      let cardMatch;
      while ((cardMatch = cardRegex.exec(html)) !== null) {
        const cardHtml = cardMatch[1];
        const urlMatch = cardHtml.match(/<a[^>]+data-testid="listing-details-link"[^>]+href="([^"]+)"/);
        const url = urlMatch ? 'https://www.zoopla.co.uk' + urlMatch[1] : null;
        const priceMatch = cardHtml.match(/<p[^>]+data-testid="listing-price"[^>]*>([^<]+)<\/p>/);
        const priceStr = priceMatch ? priceMatch[1].replace(/[^\d]/g, '') : null;
        const price = priceStr ? parseInt(priceStr, 10) : null;
        const titleMatch = cardHtml.match(/<h2[^>]+data-testid="listing-title"[^>]*>([^<]+)<\/h2>/);
        const title = titleMatch ? titleMatch[1].trim() : null;
        const addrMatch = cardHtml.match(/<p[^>]+data-testid="listing-address"[^>]*>([^<]+)<\/p>/);
        const address = addrMatch ? addrMatch[1].trim() : null;
        const imgMatch = cardHtml.match(/<img[^>]+data-testid="listing-image"[^>]+src="([^"]+)"/);
        const imgUrl = imgMatch ? imgMatch[1] : null;
        let bedrooms = null;
        const bedsMatch = title && title.match(/(\d+)\s*bed/i);
        if (bedsMatch) bedrooms = parseInt(bedsMatch[1], 10);
        let bathrooms = null;
        const bathMatch = cardHtml.match(/(\d+)\s*bath/i);
        if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);
        let type = null;
        if (/semi[- ]?detached/i.test(title)) type = 'semi-detached';
        else if (/detached/i.test(title)) type = 'detached';
        else type = 'other';
        if (url && price) {
          results.push({
            url, price, title, address, image: imgUrl, bedrooms, bathrooms, type, source: 'Zoopla'
          });
        }
      }
    } else if (site === 'otm') {
      // --- OnTheMarket parsing ---
      const cardRegex = /<div[^>]+class="property-result"[^>]*>([\s\S]*?)(?=<div[^>]+class="property-result|<\/main>)/g;
      let cardMatch;
      while ((cardMatch = cardRegex.exec(html)) !== null) {
        const cardHtml = cardMatch[1];
        const urlMatch = cardHtml.match(/<a[^>]+class="property-result-title-link"[^>]+href="([^"]+)"/);
        const url = urlMatch ? 'https://www.onthemarket.com' + urlMatch[1] : null;
        const priceMatch = cardHtml.match(/<span[^>]+class="property-result-price-value"[^>]*>([^<]+)<\/span>/);
        const priceStr = priceMatch ? priceMatch[1].replace(/[^\d]/g, '') : null;
        const price = priceStr ? parseInt(priceStr, 10) : null;
        const titleMatch = cardHtml.match(/<span[^>]+class="property-result-title-text"[^>]*>([^<]+)<\/span>/);
        const title = titleMatch ? titleMatch[1].trim() : null;
        const addrMatch = cardHtml.match(/<span[^>]+class="property-result-address"[^>]*>([^<]+)<\/span>/);
        const address = addrMatch ? addrMatch[1].trim() : null;
        const imgMatch = cardHtml.match(/<img[^>]+class="property-result-image"[^>]+src="([^"]+)"/);
        const imgUrl = imgMatch ? imgMatch[1] : null;
        let bedrooms = null;
        const bedsMatch = title && title.match(/(\d+)\s*bed/i);
        if (bedsMatch) bedrooms = parseInt(bedsMatch[1], 10);
        let bathrooms = null;
        const bathMatch = cardHtml.match(/(\d+)\s*bath/i);
        if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);
        let type = null;
        if (/semi[- ]?detached/i.test(title)) type = 'semi-detached';
        else if (/detached/i.test(title)) type = 'detached';
        else type = 'other';
        if (url && price) {
          results.push({
            url, price, title, address, image: imgUrl, bedrooms, bathrooms, type, source: 'OnTheMarket'
          });
        }
      }
    }
    return Response.json(results);
  }
}
