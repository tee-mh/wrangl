// Lincolnshire New-Build Tracker App
// Core data and logic

// RSS-enabled property data integration
const DEVELOPERS = [
    // Example with RSS feeds (replace with real feeds as found)
    { name: "Rightmove", website: "https://www.rightmove.co.uk/", rss: "https://www.rightmove.co.uk/rss/property-for-sale/find.html?locationIdentifier=REGION%5E943&minBedrooms=3&maxPrice=230000&propertyTypes=detached,semi-detached&includeSSTC=false" },
    // Add more developers and their RSS feeds here as available
];

const GRAVEYARDS = [
    // Example: { name: "Lincoln Cemetery", location: { lat: 53.234, lng: -0.540 } }
    // Add more as needed, or fetch from a public dataset
];

const WORKER_BASE = 'https://price-tracker.tmhundy.workers.dev';
const SOURCES = [
    {
        name: 'Rightmove',
        url: WORKER_BASE + '?target=https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E61310&propertyTypes=detached,semi-detached&minBedrooms=3&maxPrice=230000&includeSSTC=false'
    },
    {
        name: 'Zoopla',
        url: WORKER_BASE + '?target=https://www.zoopla.co.uk/for-sale/property/lincolnshire/?beds_min=3&price_max=230000&property_type=detached,semi-detached&include_sold=false'
    },
    {
        name: 'OnTheMarket',
        url: WORKER_BASE + '?target=https://www.onthemarket.com/for-sale/property/lincolnshire/?min-bedrooms=3&max-price=230000&property-type=detached,semi-detached'
    },
    {
        name: 'Gleeson',
        url: WORKER_BASE + '?target=https://gleesonhomes.co.uk/developments/'
    },
    {
        name: 'Keepmoat',
        url: WORKER_BASE + '?target=https://www.keepmoat.com/new-homes/'
    },
    {
        name: 'Persimmon',
        url: WORKER_BASE + '?target=https://www.persimmonhomes.com/new-homes/'
    },
    {
        name: 'Allison',
        url: WORKER_BASE + '?target=https://allison-homes.co.uk/developments/'
    },
    {
        name: 'Bellway',
        url: WORKER_BASE + '?target=https://www.bellway.co.uk/new-homes/'
    }
];
let selectedSource = 'All'; // or 'Rightmove', 'Zoopla', 'OnTheMarket'
let properties = [];

async function geocodeAddress(address) {
    // Use localStorage as a cache
    const cacheKey = 'geo_' + encodeURIComponent(address);
    if (localStorage[cacheKey]) {
        try {
            return JSON.parse(localStorage[cacheKey]);
        } catch { /* ignore */ }
    }
    // Nominatim API (OpenStreetMap)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Lincolnshire, UK')}`;
    const resp = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'Lincolnshire-Price-Tracker/1.0' } });
    const data = await resp.json();
    if (data && data.length > 0) {
        const loc = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        localStorage[cacheKey] = JSON.stringify(loc);
        return loc;
    }
    return null;
}

async function loadProperties() {
    window.isLoadingProperties = true;
    renderFeed();
    let allResults = [];
    let errors = [];
    let sourcesToFetch = selectedSource === 'All' ? SOURCES : SOURCES.filter(s => s.name === selectedSource);
    
    // Show loading message
    const propertyFeed = document.getElementById('propertyFeed');
    propertyFeed.innerHTML = '<div class="alert alert-info">Loading properties, please wait...</div>';
    
    for (const src of sourcesToFetch) {
        try {
            console.log(`Fetching from ${src.name}...`);
            const response = await fetch(src.url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format received');
            }
            
            console.log(`Received ${data.length} properties from ${src.name}`);
            
            // Add source information to each property
            const processedData = data.map(item => ({
                ...item,
                source: src.name
            }));
            
            allResults = [...allResults, ...processedData];
            
        } catch (error) {
            console.error(`Failed to load from ${src.name}:`, error);
            errors.push({
                source: src.name,
                error: error.message
            });
            
            // Show error in UI
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-warning';
            errorDiv.textContent = `Failed to load properties from ${src.name}. ${error.message}`;
            propertyFeed.appendChild(errorDiv);
        }
    }
    // Normalize and geocode properties with better error handling
    try {
        const normalizedProperties = [];
        
        // Process properties in batches to avoid overwhelming the geocoding service
        const BATCH_SIZE = 5;
        for (let i = 0; i < allResults.length; i += BATCH_SIZE) {
            const batch = allResults.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(batch.map(async (item, index) => {
                try {
                    let location = null;
                    if (item.address) {
                        console.log(`Geocoding address for: ${item.title || 'Untitled Property'}`);
                        location = await geocodeAddress(item.address);
                    }
                    
                    return {
                        id: item.url || `property-${i + index}-${Date.now()}`,
                        developer: item.source || 'Unknown',
                        title: item.title || 'Untitled Property',
                        price: item.price ? parseInt(item.price.toString().replace(/[^0-9]/g, ''), 10) : null,
                        address: item.address || 'Address not available',
                        location,
                        bedrooms: parseInt(item.bedrooms, 10) || 3,
                        bathrooms: parseInt(item.bathrooms, 10) || 2,
                        detached: item.type ? item.type.toLowerCase() === 'detached' : false,
                        semiDetached: item.type ? item.type.toLowerCase() === 'semi-detached' : false,
                        garage: item.title ? /garage|parking|driveway/i.test(item.title) : false,
                        listingDate: item.listingDate || new Date().toISOString().split('T')[0],
                        lastPriceChange: item.lastPriceChange || '',
                        url: item.url || '#',
                        image: item.image || 'https://via.placeholder.com/300x200?text=No+Image',
                        source: item.source || 'Unknown',
                        description: item.description || ''
                    };
                } catch (error) {
                    console.error(`Error processing property ${i + index}:`, error);
                    return null; // Skip this property if there's an error
                }
            }));
            
            // Filter out any null values from failed property processing
            const validProperties = batchResults.filter(p => p !== null);
            normalizedProperties.push(...validProperties);
            
            // Update UI with progress
            const progress = Math.min(i + BATCH_SIZE, allResults.length);
            propertyFeed.innerHTML = `
                <div class="alert alert-info">
                    Loading properties... ${progress} of ${allResults.length} processed
                </div>
            `;
        }
        
        properties = normalizedProperties;
        
        // Save to localStorage for offline use
        try {
            localStorage.setItem('cachedProperties', JSON.stringify(properties));
            localStorage.setItem('lastUpdated', new Date().toISOString());
        } catch (storageError) {
            console.warn('Could not save to localStorage:', storageError);
        }
        
    } catch (error) {
        console.error('Error processing properties:', error);
        propertyFeed.innerHTML = `
            <div class="alert alert-danger">
                Error processing property data. ${error.message}
            </div>
        `;
    } finally {
        window.isLoadingProperties = false;
        renderFeed();
        renderMap();
        
        // Show any errors that occurred during loading
        if (errors.length > 0) {
            const errorMessages = errors.map(e => `${e.source}: ${e.error}`).join('\n');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-warning mt-3';
            errorDiv.innerHTML = `
                <strong>Some sources failed to load:</strong>
                <pre class="mt-2 mb-0">${errorMessages}</pre>
                <p class="mb-0 mt-2">Showing cached results if available.</p>
            `;
            propertyFeed.insertBefore(errorDiv, propertyFeed.firstChild);
        }
        
        // If no properties were loaded, try to load from cache
        if (properties.length === 0) {
            try {
                const cached = localStorage.getItem('cachedProperties');
                if (cached) {
                    properties = JSON.parse(cached);
                    const lastUpdated = localStorage.getItem('lastUpdated');
                    const cacheNotice = document.createElement('div');
                    cacheNotice.className = 'alert alert-info';
                    cacheNotice.textContent = `Showing cached data from ${new Date(lastUpdated).toLocaleString()}`;
                    propertyFeed.insertBefore(cacheNotice, propertyFeed.firstChild);
                    renderFeed();
                    renderMap();
                }
            } catch (cacheError) {
                console.error('Error loading cached properties:', cacheError);
            }
        }
    }
}

// Fetch and parse RSS feed using AllOrigins proxy
async function fetchPropertiesFromRSS(rssUrl, developerName) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
        const resp = await fetch(proxyUrl);
        const data = await resp.json();
        const parser = new DOMParser();
        const xml = parser.parseFromString(data.contents, "text/xml");
        const items = xml.querySelectorAll("item");
        let results = [];
        items.forEach(item => {
            // Normalize RSS fields to our property format
            let title = item.querySelector("title")?.textContent || "";
            let link = item.querySelector("link")?.textContent || "";
            let pubDate = item.querySelector("pubDate")?.textContent || "";
            let desc = item.querySelector("description")?.textContent || "";
            // Basic extraction, can be improved for each feed
            let priceMatch = desc.match(/£([\d,]+)/);
            let price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ""), 10) : null;
            let bedsMatch = title.match(/(\d+)\s*bed/i);
            let bedrooms = bedsMatch ? parseInt(bedsMatch[1], 10) : 3;
            let baths = 2; // Not always present in RSS, default to 2
            let detached = /detached/i.test(title);
            let semiDetached = /semi[- ]?detached/i.test(title);
            let garage = /garage/i.test(title + desc);
            let address = desc.split("<br")[0] || title;
            // Geolocation not in RSS, so skip map filtering for live feeds
            results.push({
                id: developerName + "-" + btoa(link).substring(0,8),
                developer: developerName,
                title,
                price,
                address,
                location: null, // Not available from RSS
                bedrooms,
                bathrooms: baths,
                detached,
                semiDetached,
                garage,
                listingDate: pubDate ? new Date(pubDate).toISOString().slice(0,10) : "",
                lastPriceChange: pubDate ? new Date(pubDate).toISOString().slice(0,10) : "",
                url: link
            });
        });
        return results;
    } catch (e) {
        return [];
    }
}

// Load properties from RSS feeds or fallback to localStorage or mock data
async function loadProperties() {
    let all = [];
    for (let dev of DEVELOPERS) {
        if (dev.rss) {
            let props = await fetchPropertiesFromRSS(dev.rss, dev.name);
            all = all.concat(props);
        }
    }
    if (all.length) {
        properties = all;
        localStorage.setItem('properties', JSON.stringify(properties));
    } else {
        // fallback: try localStorage
        let cached = localStorage.getItem('properties');
        if (cached) {
            properties = JSON.parse(cached);
        } else {
            properties = [];
        }
        }
    }


// Helper: Calculate distance in miles between two lat/lng points
function haversine(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Radius of Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Geo-exclusion: Exclude properties within 0.5 miles of any graveyard
function geoExclude(props) {
    if (GRAVEYARDS.length === 0) return props;
    return props.filter(p =>
        !GRAVEYARDS.some(g => haversine(p.location.lat, p.location.lng, g.location.lat, g.location.lng) < 0.5)
    );
}

// Filtering
function applyFilters(props) {
    const detached = document.getElementById('detachedFilter').checked;
    const semiDetached = document.getElementById('semiDetachedFilter').checked;
    const garage = document.getElementById('garageFilter').checked;
    const minBeds = parseInt(document.getElementById('bedroomsFilter').value, 10);
    const minBaths = parseInt(document.getElementById('bathroomsFilter').value, 10);
    const minPrice = parseInt(document.getElementById('minPriceFilter').value, 10);
    const maxPrice = parseInt(document.getElementById('maxPriceFilter').value, 10);
    const radius = parseInt(document.getElementById('radiusFilter').value, 10) || 30;
    // Center of Lincolnshire (approx)
    const center = { lat: 53.233, lng: -0.539 };
    return props.filter(p =>
        ((detached && p.detached) || (semiDetached && p.semiDetached)) &&
        (!garage || p.garage) &&
        p.bedrooms >= minBeds &&
        p.bathrooms >= minBaths &&
        p.price >= minPrice && p.price <= maxPrice &&
        haversine(p.location.lat, p.location.lng, center.lat, center.lng) <= radius
    );
}

// Render property feed
function renderFeed() {
    const feed = document.getElementById('propertyFeed');
    feed.innerHTML = '';
    // Loading spinner
    if (window.isLoadingProperties) {
        feed.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading...</span></div><div>Loading properties...</div></div>';
        return;
    }
    let filtered = applyFilters(properties);
    if (!filtered.length) {
        feed.innerHTML = '<div class="alert alert-warning">No properties found matching your filters.</div>';
        return;
    }
    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'property-card mb-4 p-3 shadow-sm rounded row';
        card.innerHTML = `
          <div class="col-12 col-md-4 mb-2 mb-md-0">
            <img src="${p.image || 'https://via.placeholder.com/240x180?text=No+Image'}" class="img-fluid rounded" style="max-height:180px;object-fit:cover;" alt="Property image">
          </div>
          <div class="col-12 col-md-8">
            <div class="d-flex align-items-center mb-2">
              <span class="badge bg-purple me-2">Rightmove</span>
              ${p.detached ? '<span class="badge bg-success me-1">Detached</span>' : ''}
              ${p.semiDetached ? '<span class="badge bg-warning text-dark me-1">Semi-Detached</span>' : ''}
              ${p.garage ? '<span class="badge bg-gold text-dark me-1">Garage</span>' : ''}
            </div>
            <h5 class="mb-1">${p.title}</h5>
            <div class="mb-1 text-gold fw-bold fs-5">£${p.price ? p.price.toLocaleString() : 'N/A'}</div>
            <div class="mb-1 text-muted">${p.address}</div>
            <div class="mb-2 small">${p.bedrooms} bed, ${p.bathrooms} bath</div>
            <a href="${p.url}" target="_blank" class="btn btn-sm btn-main">View Listing</a>
            <button class="favorite-btn ms-2 ${isFavorite(p.id) ? 'active' : ''}" onclick="toggleFavorite('${p.id}')">&#9733;</button>
          </div>
        `;
        feed.appendChild(card);
    });
}

// Add custom badge colors
(function() {
    const style = document.createElement('style');
    style.innerHTML = `.bg-purple { background: var(--main-purple)!important; color: #fff!important; }
    .bg-gold { background: var(--main-gold)!important; color: var(--main-purple)!important; }
    .text-gold { color: var(--main-gold)!important; }`;
    document.head.appendChild(style);
})();
function getDeveloperWebsite(name) {
    const dev = DEVELOPERS.find(d => d.name === name);
    return dev ? dev.website : '#';
}


// Watchlist (Favorites) using localStorage
function getFavorites() {
    return JSON.parse(localStorage.getItem('favorites') || '[]');
}
function isFavorite(id) {
    return getFavorites().includes(id);
}
function toggleFavorite(id) {
    let favs = getFavorites();
    if (favs.includes(id)) {
        favs = favs.filter(f => f !== id);
    } else {
        favs.push(id);
    }
    localStorage.setItem('favorites', JSON.stringify(favs));
    renderFeed();
    renderFavorites();
}
function renderFavorites() {
    let favs = getFavorites();
    let favList = document.getElementById('favoritesList');
    favList.innerHTML = '';
    let favProps = properties.filter(p => favs.includes(p.id));
    if (!favProps.length) {
        favList.innerHTML = '<li>No properties in your watchlist.</li>';
        return;
    }
    favProps.forEach(p => {
        favList.innerHTML += `<li><a href="${p.url}" target="_blank">${p.title}</a> <button onclick="toggleFavorite('${p.id}')">Remove</button></li>`;
    });
}

// Saved Searches using localStorage
function getSavedSearches() {
    return JSON.parse(localStorage.getItem('savedSearches') || '[]');
}
function saveCurrentSearch() {
    const search = {
        detached: document.getElementById('detachedFilter').checked,
        garage: document.getElementById('garageFilter').checked,
        bedrooms: parseInt(document.getElementById('bedroomsFilter').value, 10),
        bathrooms: parseInt(document.getElementById('bathroomsFilter').value, 10),
        minPrice: parseInt(document.getElementById('minPriceFilter').value, 10),
        maxPrice: parseInt(document.getElementById('maxPriceFilter').value, 10),
        radius: parseInt(document.getElementById('radiusFilter').value, 10)
    };
    let searches = getSavedSearches();
    searches.push(search);
    localStorage.setItem('savedSearches', JSON.stringify(searches));
    renderSavedSearches();
}
function applySavedSearch(idx) {
    const search = getSavedSearches()[idx];
    document.getElementById('detachedFilter').checked = search.detached;
    document.getElementById('garageFilter').checked = search.garage;
    document.getElementById('bedroomsFilter').value = search.bedrooms;
    document.getElementById('bathroomsFilter').value = search.bathrooms;
    document.getElementById('minPriceFilter').value = search.minPrice || 180000;
    document.getElementById('maxPriceFilter').value = search.maxPrice || 230000;
    document.getElementById('radiusFilter').value = search.radius || 30;
    renderFeed();
}
function renderSavedSearches() {
    let list = document.getElementById('savedSearchList');
    let searches = getSavedSearches();
    list.innerHTML = '';
    if (!searches.length) {
        list.innerHTML = '<li>No saved searches.</li>';
        return;
    }
    searches.forEach((s, i) => {
        list.innerHTML += `<li>Detached: ${s.detached ? 'Yes' : 'No'}, Garage: ${s.garage ? 'Yes' : 'No'}, Beds: ${s.bedrooms}, Baths: ${s.bathrooms}, Price: £${s.minPrice || 180000}-£${s.maxPrice || 230000}, Radius: ${s.radius || 30}mi <button onclick="applySavedSearch(${i})">Apply</button></li>`;
    });
}

// Map View (simple placeholder, can use Leaflet/OpenStreetMap for real map)
let currentMap = null;

function renderMap() {
    let mapDiv = document.getElementById('map');
    
    // Remove existing map if it exists
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
    }
    
    // Only use properties with geolocation
    let geoProps = properties.filter(p => p.location && p.location.lat && p.location.lng);
    console.log('Properties with location:', geoProps.length, geoProps);
    
    if (!geoProps.length) {
        mapDiv.innerHTML = '<div class="alert alert-info">No properties with map location available. Properties need geocoding.</div>';
        return;
    }
    
    // Clear any existing content
    mapDiv.innerHTML = '';
    
    // Create new map
    currentMap = L.map('map').setView([53.233, -0.539], 9); // Lincolnshire center
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(currentMap);
    
    // Add property markers
    geoProps.forEach(p => {
        let marker = L.marker([p.location.lat, p.location.lng]).addTo(currentMap);
        marker.bindPopup(`<b>${p.title}</b><br>£${p.price ? p.price.toLocaleString() : 'N/A'}<br>${p.address}<br><span class="badge bg-secondary">${p.source}</span>`);
    });
    
    // Add graveyard exclusion zones
    GRAVEYARDS.forEach(g => {
        if (g.location && g.location.lat && g.location.lng) {
            L.circle([g.location.lat, g.location.lng], {
                color: 'red',
                fillColor: '#f03',
                fillOpacity: 0.2,
                radius: 0.5 * 1609.34 // 0.5 miles in meters
            }).addTo(currentMap).bindPopup(`${g.name} (exclusion zone)`);
        }
    });
    
    console.log('Map rendered with', geoProps.length, 'properties');
}

// Push Notifications (browser)
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission();
    }
}
function sendNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body });
    }
}

// Daily/Weekly Update Simulation
function checkForUpdates() {
    // Simulate new listing notification
    sendNotification('Lincolnshire New-Builds', 'New listings available matching your filters!');
    // Simulate weekly price change notification
    sendNotification('Watchlist Price Update', 'Weekly summary: Price changes on your watchlist.');
}

// Watchlist Expiry Reminder
function checkWatchlistExpiry() {
    let favs = getFavorites();
    let now = new Date();
    properties.forEach(p => {
        if (favs.includes(p.id)) {
            let listed = new Date(p.listingDate);
            let days = Math.floor((now - listed) / (1000*60*60*24));
            if (days > 90) {
                sendNotification('Watchlist Expiry', `${p.title} has been listed for over 90 days.`);
            }
        }
    });
}

// Event Listeners
window.onload = async function() {
    try {
        await loadProperties();
    } catch (e) {
        // fallback to whatever is in properties already
        console.error('Failed to load live properties:', e);
    }
    renderFeed();
    renderFavorites();
    renderSavedSearches();
    renderMap();
    requestNotificationPermission();

    document.getElementById('updateSearchBtn').onclick = function() {
        renderFeed();
        renderMap();
    };
    document.getElementById('saveSearchBtn').onclick = saveCurrentSearch;
    document.getElementById('listViewBtn').onclick = function() {
        document.getElementById('propertyFeed').style.display = '';
        document.getElementById('map').style.display = 'none';
        this.classList.add('active');
        document.getElementById('mapViewBtn').classList.remove('active');
    };
    document.getElementById('mapViewBtn').onclick = function() {
        document.getElementById('propertyFeed').style.display = 'none';
        document.getElementById('map').style.display = '';
        this.classList.add('active');
        document.getElementById('listViewBtn').classList.remove('active');
        renderMap();
    };
    // Source dropdown
    document.getElementById('sourceSelect').onchange = async function() {
        selectedSource = this.value;
        window.isLoadingProperties = true;
        renderFeed();
        await loadProperties();
    };
    // Simulate daily/weekly update checks
    setTimeout(checkForUpdates, 2000); // Simulate after 2s
    setTimeout(checkWatchlistExpiry, 4000); // Simulate after 4s
};

// Expose for inline HTML onclick
window.toggleFavorite = toggleFavorite;
window.applySavedSearch = applySavedSearch;
