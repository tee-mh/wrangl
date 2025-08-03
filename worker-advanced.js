// Cloudflare Worker: Multi-site Property Scraper with fallback to fetch-based scraping
import { scrapeProperties } from './scraper.js';

// Simple fetch-based fallback scraper for when Puppeteer fails
async function simpleFetchScraper(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // Basic parsing based on site
    if (url.includes('rightmove.co.uk')) {
      return parseRightmove(html);
    } else if (url.includes('zoopla.co.uk')) {
      return parseZoopla(html);
    } else if (url.includes('onthemarket.com')) {
      return parseOnTheMarket(html);
    }
    
    return [];
  } catch (error) {
    console.error('Error in simpleFetchScraper:', error);
    return [];
  }
}

// Simple HTML parsing functions for each site
function parseRightmove(html) {
  // This is a simplified parser - would need to be expanded
  const properties = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Basic property card extraction
  const cards = doc.querySelectorAll('.propertyCard');
  cards.forEach(card => {
    try {
      const titleEl = card.querySelector('.propertyCard-title');
      const priceEl = card.querySelector('.propertyCard-priceValue');
      const addressEl = card.querySelector('address');
      const linkEl = card.querySelector('.propertyCard-link');
      
      if (titleEl && priceEl && addressEl && linkEl) {
        properties.push({
          title: titleEl.textContent.trim(),
          price: parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10) || 0,
          address: addressEl.textContent.trim(),
          url: `https://www.rightmove.co.uk${linkEl.getAttribute('href')}`,
          source: 'Rightmove',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error parsing property card:', error);
    }
  });
  
  return properties;
}

function parseZoopla(html) {
  const properties = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Basic property card extraction for Zoopla
  const cards = doc.querySelectorAll('[data-testid="search-result"]');
  cards.forEach(card => {
    try {
      const titleEl = card.querySelector('[data-testid="listing-title"]');
      const priceEl = card.querySelector('[data-testid="listing-price"]');
      const addressEl = card.querySelector('[data-testid="listing-address"]');
      const linkEl = card.querySelector('a[data-testid="listing-details-link"]');
      
      if (titleEl && priceEl && addressEl && linkEl) {
        properties.push({
          title: titleEl.textContent.trim(),
          price: parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10) || 0,
          address: addressEl.textContent.trim(),
          url: `https://www.zoopla.co.uk${linkEl.getAttribute('href')}`,
          source: 'Zoopla',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error parsing Zoopla property card:', error);
    }
  });
  
  return properties;
}

function parseOnTheMarket(html) {
  const properties = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Basic property card extraction for OnTheMarket
  const cards = doc.querySelectorAll('.property-result');
  cards.forEach(card => {
    try {
      const titleEl = card.querySelector('.property-result-title-text');
      const priceEl = card.querySelector('.property-result-price-value');
      const addressEl = card.querySelector('.property-result-address');
      const linkEl = card.querySelector('a.property-result-title-link');
      
      if (titleEl && priceEl && addressEl && linkEl) {
        properties.push({
          title: titleEl.textContent.trim(),
          price: parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10) || 0,
          address: addressEl.textContent.trim(),
          url: `https://www.onthemarket.com${linkEl.getAttribute('href')}`,
          source: 'OnTheMarket',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error parsing OnTheMarket property card:', error);
    }
  });
  
  return properties;
}

// Helper function to filter properties based on user criteria
function filterProperties(properties) {
  return properties.filter(property => {
    // Price range: £180,000 - £230,000
    const inPriceRange = property.price >= 180000 && property.price <= 230000;
    
    // Property type: detached or semi-detached
    const validType = property.type === 'detached' || property.type === 'semi-detached';
    
    // Bedrooms: 3+ and Bathrooms: 2+
    const validRooms = property.bedrooms >= 3 && property.bathrooms >= 2;
    
    return inPriceRange && validType && validRooms;
  });
}

export default {
  async fetch(request, env, ctx) {
    let debugInfo = [];
    let site = '';
    let searchUrl = '';
    let debugMode = false;
    let corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      searchUrl = url.searchParams.get('target');
      debugMode = url.searchParams.get('debug') === '1';
      
      if (!searchUrl) {
        return new Response(JSON.stringify({
          error: 'Missing target URL',
          message: 'Please provide a target URL using the ?target= parameter',
          example: '?target=https://example.com'
        }), { 
          status: 400, 
          headers: corsHeaders
        });
      }
      
      // Identify site
      if (searchUrl.includes('rightmove.co.uk')) site = 'rightmove';
      else if (searchUrl.includes('zoopla.co.uk')) site = 'zoopla';
      else if (searchUrl.includes('onthemarket.com')) site = 'otm';
      else if (searchUrl.includes('gleesonhomes.co.uk')) site = 'gleeson';
      else if (searchUrl.includes('keepmoat.com')) site = 'keepmoat';
      else if (searchUrl.includes('persimmonhomes.com')) site = 'persimmon';
      else if (searchUrl.includes('allison-homes.co.uk')) site = 'allison';
      else if (searchUrl.includes('bellway.co.uk')) site = 'bellway';
      else {
        return new Response(JSON.stringify({
          error: 'Unsupported site',
          message: 'The provided URL is not from a supported property site.'
        }), { 
          status: 400, 
          headers: corsHeaders
        });
      }

      let results = [];
      
      // Use the Puppeteer-based scraper for all sites
      try {
        debugInfo.push(`Using Puppeteer to scrape ${site}`);
        
        // Import the scraper module dynamically
        const { scrapeProperties } = await import('./scraper.js');
        results = await scrapeProperties(searchUrl);
        debugInfo.push(`Found ${results.length} properties`);
        
        // Filter properties based on our criteria
        results = filterProperties(results);
        debugInfo.push(`Successfully scraped and filtered ${results.length} properties from ${site}`);
        
        // Return the results
        return new Response(JSON.stringify({
          success: true,
          count: results.length,
          properties: results,
          ...(debugMode && { debug: debugInfo })
        }), { 
          headers: corsHeaders,
          status: 200
        });
        
      } catch (error) {
        console.error(`Error scraping ${site}:`, error);
        debugInfo.push(`Error scraping ${site}: ${error.message}`);
        
        // Fallback to simple fetch-based scraping if Puppeteer fails
        try {
          debugInfo.push('Attempting fallback to simple fetch-based scraping...');
          const fallbackResults = await simpleFetchScraper(searchUrl);
          const filteredResults = filterProperties(fallbackResults);
          
          debugInfo.push(`Fallback scraping successful, found ${filteredResults.length} properties`);
          
          return new Response(JSON.stringify({
            success: true,
            count: filteredResults.length,
            properties: filteredResults,
            fallback: true,
            ...(debugMode && { debug: debugInfo })
          }), { 
            headers: corsHeaders,
            status: 200
          });
          
        } catch (fallbackError) {
          console.error('Fallback scraping failed:', fallbackError);
          debugInfo.push(`Fallback scraping failed: ${fallbackError.message}`);
          
          // Return error response with debug info if enabled
          const errorResponse = {
            success: false,
            error: `Failed to scrape ${site}`,
            message: 'An error occurred while scraping the website.',
            ...(debugMode && { 
              debug: debugInfo,
              error_details: {
                message: error.message,
                stack: error.stack,
                fallback_error: fallbackError.message
              }
            })
          };
          
          return new Response(JSON.stringify(errorResponse), { 
            status: 500, 
            headers: corsHeaders
          });
        }
      }
    } catch (error) {
      console.error('Worker error:', error);
      // Always return error details in development
      const errorResponse = {
        error: error.message,
        name: error.name,
        url: searchUrl,
        site: site || 'unknown',
        timestamp: new Date().toISOString()
      };
      
      if (debugMode) {
        errorResponse.stack = error.stack;
        errorResponse.debug = debugInfo;
      }
      
      return new Response(JSON.stringify(errorResponse), { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      });
    }
  }
}
