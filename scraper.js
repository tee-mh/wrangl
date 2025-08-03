// Cloudflare Worker-compatible property scraper
import puppeteer from '@cloudflare/puppeteer';

// Common user agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

// Simple fetch-based scraper as fallback
export async function simpleScrapeProperties(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // This is a very basic implementation and would need to be expanded
    // based on the specific site being scraped
    return [];
  } catch (error) {
    console.error('Error in simpleScrapeProperties:', error);
    return [];
  }
}

class PropertyScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    // Launch browser with Cloudflare Puppeteer
    this.browser = await puppeteer.launch({
      browser: 'chromium',
      headless: true
    });

    // Create a new page
    this.page = await this.browser.newPage();
    
    // Set a random user agent
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await this.page.setUserAgent(userAgent);
    
    // Set extra headers to look more like a real browser
    await this.page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'upgrade-insecure-requests': '1',
    });

    // Block unnecessary resources to speed up page load
    await this.page.setRequestInterception(true);
    this.page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  async scrapeRightmove(url) {
    try {
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });

      // Wait for property cards to load
      await this.page.waitForSelector('.propertyCard', { timeout: 30000 });

      // Scroll to load lazy-loaded content
      await this.autoScroll();

      // Extract property data
      const properties = await this.page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.propertyCard'));
        return cards.map(card => {
          const titleEl = card.querySelector('.propertyCard-title');
          const priceEl = card.querySelector('.propertyCard-priceValue');
          const addressEl = card.querySelector('address');
          const imgEl = card.querySelector('.propertyCard-img');
          const linkEl = card.querySelector('.propertyCard-link');
          
          // Extract bedroom and bathroom info
          let bedrooms = null;
          let bathrooms = null;
          const infoText = card.textContent.toLowerCase();
          const bedMatch = infoText.match(/(\d+)\s*bed/i);
          const bathMatch = infoText.match(/(\d+)\s*bath/i);
          
          if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);
          if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);
          
          // Determine property type
          let type = 'other';
          if (infoText.includes('detached')) type = 'detached';
          else if (infoText.includes('semi-detached') || infoText.includes('semi detached')) type = 'semi-detached';
          
          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            price: priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10) : 0,
            address: addressEl ? addressEl.textContent.trim() : '',
            url: linkEl ? `https://www.rightmove.co.uk${linkEl.getAttribute('href')}` : '',
            image: imgEl ? imgEl.getAttribute('src') : '',
            bedrooms,
            bathrooms,
            type,
            source: 'Rightmove',
            timestamp: new Date().toISOString()
          };
        });
      });

      return properties.filter(p => p.price > 0); // Only return properties with valid prices
    } catch (error) {
      console.error('Error scraping Rightmove:', error);
      throw error;
    }
  }

  async scrapeZoopla(url) {
    // Implementation for Zoopla
    try {
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });

      // Wait for property cards to load
      await this.page.waitForSelector('[data-testid="search-result"]', { timeout: 30000 });
      await this.autoScroll();

      const properties = await this.page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('[data-testid="search-result"]'));
        return cards.map(card => {
          const titleEl = card.querySelector('[data-testid="listing-title"]');
          const priceEl = card.querySelector('[data-testid="listing-price"]');
          const addressEl = card.querySelector('[data-testid="listing-address"]');
          const imgEl = card.querySelector('img[data-testid="listing-image"]');
          const linkEl = card.querySelector('a[data-testid="listing-details-link"]');
          
          // Extract bedroom and bathroom info
          let bedrooms = null;
          let bathrooms = null;
          const infoText = card.textContent.toLowerCase();
          const bedMatch = infoText.match(/(\d+)\s*bed/i);
          const bathMatch = infoText.match(/(\d+)\s*bath/i);
          
          if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);
          if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);
          
          // Determine property type
          let type = 'other';
          if (infoText.includes('detached')) type = 'detached';
          else if (infoText.includes('semi-detached') || infoText.includes('semi detached')) type = 'semi-detached';
          
          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            price: priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10) : 0,
            address: addressEl ? addressEl.textContent.trim() : '',
            url: linkEl ? `https://www.zoopla.co.uk${linkEl.getAttribute('href')}` : '',
            image: imgEl ? imgEl.getAttribute('src') : '',
            bedrooms,
            bathrooms,
            type,
            source: 'Zoopla',
            timestamp: new Date().toISOString()
          };
        });
      });

      return properties.filter(p => p.price > 0);
    } catch (error) {
      console.error('Error scraping Zoopla:', error);
      throw error;
    }
  }

  async scrapeOnTheMarket(url) {
    // Implementation for OnTheMarket
    try {
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });

      // Wait for property cards to load
      await this.page.waitForSelector('.property-result', { timeout: 30000 });
      await this.autoScroll();

      const properties = await this.page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.property-result'));
        return cards.map(card => {
          const titleEl = card.querySelector('.property-result-title-text');
          const priceEl = card.querySelector('.property-result-price-value');
          const addressEl = card.querySelector('.property-result-address');
          const imgEl = card.querySelector('.property-result-image');
          const linkEl = card.querySelector('a.property-result-title-link');
          
          // Extract bedroom and bathroom info
          let bedrooms = null;
          let bathrooms = null;
          const infoText = card.textContent.toLowerCase();
          const bedMatch = infoText.match(/(\d+)\s*bed/i);
          const bathMatch = infoText.match(/(\d+)\s*bath/i);
          
          if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);
          if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);
          
          // Determine property type
          let type = 'other';
          if (infoText.includes('detached')) type = 'detached';
          else if (infoText.includes('semi-detached') || infoText.includes('semi detached')) type = 'semi-detached';
          
          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            price: priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10) : 0,
            address: addressEl ? addressEl.textContent.trim() : '',
            url: linkEl ? `https://www.onthemarket.com${linkEl.getAttribute('href')}` : '',
            image: imgEl ? imgEl.getAttribute('src') : '',
            bedrooms,
            bathrooms,
            type,
            source: 'OnTheMarket',
            timestamp: new Date().toISOString()
          };
        });
      });

      return properties.filter(p => p.price > 0);
    } catch (error) {
      console.error('Error scraping OnTheMarket:', error);
      throw error;
    }
  }

  async autoScroll() {
    await this.page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight || totalHeight > 5000) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main function that handles the scraping
export async function scrapeProperties(url) {
  const scraper = new PropertyScraper();
  try {
    await scraper.initialize();
    
    if (url.includes('rightmove.co.uk')) {
      return await scraper.scrapeRightmove(url);
    } else if (url.includes('zoopla.co.uk')) {
      return await scraper.scrapeZoopla(url);
    } else if (url.includes('onthemarket.com')) {
      return await scraper.scrapeOnTheMarket(url);
    } else {
      // For unsupported sites, try the simple scraper
      console.log('Unsupported website, falling back to simple scraper');
      return await simpleScrapeProperties(url);
    }
  } catch (error) {
    console.error('Scraping failed, falling back to simple scraper:', error);
    // Fall back to simple scraper on error
    return await simpleScrapeProperties(url);
  } finally {
    try {
      await scraper.close();
    } catch (closeError) {
      console.error('Error closing browser:', closeError);
    }
  }
}

// simpleScrapeProperties is already exported at the function declaration
