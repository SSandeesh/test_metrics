/**
 * Fulfillment Metrics Dashboard - Main Application Logic
 */

// Demo/Sample Data (shows NaN until real data is loaded)
const DEMO_DATA = {
    totalOrders: { current: NaN, previous: NaN, change: 0, isHigherBetter: true },
    o2p: { current: NaN, previous: NaN, change: 0, isHigherBetter: false },
    p2s: { current: NaN, previous: NaN, change: 0, isHigherBetter: false },
    s2d: { current: NaN, previous: NaN, change: 0, isHigherBetter: false },
    o2d: { current: NaN, previous: NaN, change: 0, isHigherBetter: false },
    whOrders: { current: NaN, previous: NaN, change: 0, isHigherBetter: true },
    storeOrders: { current: NaN, previous: NaN, change: 0, isHigherBetter: true },
    o2p_Days: { current: NaN, previous: NaN, change: 0, isHigherBetter: false },
    p2s_Days: { current: NaN, previous: NaN, change: 0, isHigherBetter: false },
    s2d_Days: { current: NaN, previous: NaN, change: 0, isHigherBetter: false },
    o2d_Days: { current: NaN, previous: NaN, change: 0, isHigherBetter: false }
};

// Application State
const AppState = {
    data: [],
    filters: {
        brand: 'all',
        locationType: 'all',
        marketplaceWeb: 'all',
        fulfillmentLocation: 'all',
        startDate: null,
        endDate: null
    },
    metrics: null,
    brands: [],
    marketplaces: [],
    fulfillmentLocations: [],
    dateRange: { min: null, max: null },
    isDemoMode: true  // Start with demo mode
};

// DOM Elements
const Elements = {};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing dashboard...');
    initializeElements();
    initializeEventListeners();
    loadDefaultData();
});

function initializeElements() {
    Elements.tileGrid = document.getElementById('tile-grid');
    Elements.filterBrand = document.getElementById('filter-brand');
    Elements.filterLocation = document.getElementById('filter-location');
    Elements.filterMarketplace = document.getElementById('filter-marketplace');
    Elements.fulfillmentSelect = document.getElementById('fulfillment-select');
    Elements.dateFrom = document.getElementById('date-from');
    Elements.dateTo = document.getElementById('date-to');
    Elements.fileInput = document.getElementById('file-input');
    Elements.uploadBtn = document.getElementById('upload-btn');
    Elements.totalOrdersEl = document.getElementById('total-orders');
    Elements.activeFiltersEl = document.getElementById('active-filters');
    Elements.modalOverlay = document.getElementById('modal-overlay');
    Elements.modalTitle = document.getElementById('modal-title');
    Elements.modalBody = document.getElementById('modal-body');

    console.log('Elements initialized:', !!Elements.tileGrid, !!Elements.fileInput);
}

function initializeEventListeners() {
    // Brand filter
    Elements.filterBrand.addEventListener('click', (e) => {
        if (e.target.classList.contains('pill-btn')) {
            setBrandFilter(e.target.dataset.brand);
        }
    });

    // Location filter
    Elements.filterLocation.addEventListener('click', (e) => {
        if (e.target.classList.contains('pill-btn')) {
            setLocationFilter(e.target.dataset.location);
        }
    });

    // Marketplace filter
    Elements.filterMarketplace.addEventListener('click', (e) => {
        if (e.target.classList.contains('pill-btn')) {
            setMarketplaceFilter(e.target.dataset.marketplace);
        }
    });

    // Fulfillment location filter
    Elements.fulfillmentSelect.addEventListener('change', (e) => {
        setFulfillmentFilter(e.target.value);
    });

    // Date range
    Elements.dateFrom.addEventListener('change', handleDateChange);
    Elements.dateTo.addEventListener('change', handleDateChange);

    // File upload - direct click on the label triggers file input
    Elements.fileInput.addEventListener('change', handleFileUpload);

    // Drag and drop support
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        document.body.classList.add('drop-zone-active');
        document.body.innerHTML += '<div style="position:fixed;inset:0;background:rgba(59,130,246,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:600;">Drop CSV file here</div>';
    });

    document.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null) {
            document.body.classList.remove('drop-zone-active');
            const overlay = document.querySelector('div[style*="position:fixed;inset:0;background:rgba(59,130,246"]');
            if (overlay) overlay.remove();
        }
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        document.body.classList.remove('drop-zone-active');
        const overlay = document.querySelector('div[style*="position:fixed;inset:0;background:rgba(59,130,246"]');
        if (overlay) overlay.remove();

        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                AppState.isDemoMode = false;
                processData(event.target.result);
            };
            reader.readAsText(file);
        }
    });

    // Also add click handler to the label/button
    const uploadLabel = document.querySelector('.upload-btn');
    if (uploadLabel) {
        uploadLabel.style.cursor = 'pointer';
    }

    // Modal close
    Elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === Elements.modalOverlay) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    console.log('Event listeners initialized');
}

async function loadDefaultData() {
    showLoading();

    // First check if default data was pre-loaded via default-data.js
    if (window.DEFAULT_CSV_DATA) {
        console.log('Using pre-loaded default CSV data');
        processData(window.DEFAULT_CSV_DATA, true); // true = isDefaultData
        return;
    }

    // Try multiple methods to load the default CSV
    const paths = [
        'sample_orders_1000-1.csv',
        './sample_orders_1000-1.csv',
        '../sample_orders_1000-1.csv',
        'file:///C:/Users/sande/OneDrive/Desktop/claude%20code%20test/sample_orders_1000-1.csv',
        'file:///C:/Users/sande/OneDrive/Desktop/claude code test/sample_orders_1000-1.csv'
    ];

    for (const path of paths) {
        try {
            console.log('Trying to load from:', path);
            const response = await fetch(path);
            if (response.ok) {
                const csvText = await response.text();
                console.log('CSV loaded from:', path, 'length:', csvText.length);
                processData(csvText);
                return;
            }
        } catch (e) {
            console.log('Failed:', path, '-', e.message);
        }
    }

    // If fetch fails (CORS issue with file://), try loading via script injection
    try {
        console.log('Trying script tag injection...');
        await loadViaScriptTag();
        return;
    } catch (e) {
        console.log('Script injection failed:', e.message);
    }

    // Show demo mode if all methods fail
    console.log('All loading methods failed. Showing demo mode.');
    AppState.isDemoMode = true;
    AppState.data = [];
    showDemoMode();
}

// Alternative: Create a script element that loads the data
async function loadViaScriptTag() {
    return new Promise((resolve, reject) => {
        // Check if data was already loaded by a script
        if (window.DEFAULT_CSV_DATA) {
            processData(window.DEFAULT_CSV_DATA);
            resolve();
            return;
        }

        // Try XHR as last resort
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'sample_orders_1000-1.csv', true);

        xhr.onload = function() {
            if (xhr.status === 200) {
                processData(xhr.responseText);
                resolve();
            } else {
                reject(new Error('XHR failed'));
            }
        };

        xhr.onerror = function() {
            reject(new Error('XHR error'));
        };

        xhr.send();
    });
}

function processData(csvText, isDefaultData = false) {
    console.log('Processing data...');
    AppState.data = DataLoader.parseCSV(csvText);
    console.log('Parsed records:', AppState.data.length);

    if (AppState.data.length === 0) {
        console.error('No valid data records found!');
        showDemoMode();
        return;
    }

    AppState.isDemoMode = false;
    AppState.brands = DataLoader.getBrands(AppState.data);
    AppState.marketplaces = DataLoader.getMarketplaces(AppState.data);
    AppState.fulfillmentLocations = DataLoader.getFulfillmentLocations(AppState.data);
    AppState.dateRange = DataLoader.getDateRange(AppState.data);

    // If using default embedded data, don't apply date filter (show all data)
    // Otherwise apply the default 14-day filter
    if (!isDefaultData) {
        const defaultRange = DataLoader.getDefaultDateRange();
        AppState.filters.startDate = defaultRange.start;
        AppState.filters.endDate = defaultRange.end;
        Elements.dateFrom.value = formatDateForInput(AppState.filters.startDate);
        Elements.dateTo.value = formatDateForInput(AppState.filters.endDate);
    } else {
        // For default data, show all dates
        AppState.filters.startDate = null;
        AppState.filters.endDate = null;
        Elements.dateFrom.value = '';
        Elements.dateTo.value = '';
    }

    console.log('Brands found:', AppState.brands);
    console.log('Marketplaces found:', AppState.marketplaces);
    console.log('Fulfillment locations found:', AppState.fulfillmentLocations);
    console.log('Date range:', AppState.dateRange);

    // Update fulfillment dropdown dynamically
    updateFulfillmentDropdown();

    // Set default date range (last 14 days)
    const defaultRange = DataLoader.getDefaultDateRange();
    AppState.filters.startDate = defaultRange.start;
    AppState.filters.endDate = defaultRange.end;

    // Update date inputs
    Elements.dateFrom.value = formatDateForInput(AppState.filters.startDate);
    Elements.dateTo.value = formatDateForInput(AppState.filters.endDate);

    updateMetrics();
    updateStatsBar();
}

function showDemoMode() {
    console.log('Showing demo mode with NaN values');
    AppState.isDemoMode = true;
    AppState.metrics = DEMO_DATA;

    // Set empty date inputs for demo
    Elements.dateFrom.value = '';
    Elements.dateTo.value = '';
    Elements.totalOrdersEl.textContent = '—';
    Elements.activeFiltersEl.textContent = 'No data loaded';

    renderTiles();
}

function formatDateForInput(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function updateFulfillmentDropdown() {
    if (!Elements.fulfillmentSelect || !AppState.fulfillmentLocations.length) return;

    // Keep the "All" option
    let html = '<option value="all">All Locations</option>';

    // Add dynamic options
    AppState.fulfillmentLocations.forEach(loc => {
        html += `<option value="${loc}">${loc}</option>`;
    });

    Elements.fulfillmentSelect.innerHTML = html;
}

function setBrandFilter(brand) {
    AppState.filters.brand = brand;
    updateFilterUI('brand', brand);
    applyFilters();
}

function setLocationFilter(location) {
    AppState.filters.locationType = location;
    updateFilterUI('location', location);
    applyFilters();
}

function setMarketplaceFilter(marketplace) {
    AppState.filters.marketplaceWeb = marketplace;
    updateFilterUI('marketplace', marketplace);
    applyFilters();
}

function setFulfillmentFilter(fulfillment) {
    AppState.filters.fulfillmentLocation = fulfillment;
    applyFilters();
}

function setLocationFilter(location) {
    AppState.filters.locationType = location;
    updateFilterUI('location', location);
    applyFilters();
}

function handleDateChange() {
    const startVal = Elements.dateFrom.value;
    const endVal = Elements.dateTo.value;

    AppState.filters.startDate = startVal ? new Date(startVal) : null;
    AppState.filters.endDate = endVal ? new Date(endVal) : null;

    applyFilters();
}

function handleFileUpload(e) {
    console.log('File upload triggered', e);

    const file = e.target.files[0];
    console.log('File selected:', file);

    if (!file) {
        console.log('No file selected');
        return;
    }

    console.log('Reading file:', file.name, file.size, 'bytes');

    const reader = new FileReader();
    reader.onload = (event) => {
        console.log('File read complete, length:', event.target.result.length);
        AppState.isDemoMode = false;
        processData(event.target.result);
    };
    reader.onerror = (error) => {
        console.error('File read error:', error);
        alert('Error reading file. Please try again.');
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    e.target.value = '';
}

function updateFilterUI(type, value) {
    let group;
    if (type === 'brand') {
        group = Elements.filterBrand;
    } else if (type === 'location') {
        group = Elements.filterLocation;
    } else if (type === 'marketplace') {
        group = Elements.filterMarketplace;
    }

    if (group) {
        const buttons = group.querySelectorAll('.pill-btn');
        buttons.forEach(btn => {
            const btnValue = btn.dataset.brand || btn.dataset.location || btn.dataset.marketplace;
            btn.classList.toggle('active', btnValue === value);
        });
    }
}

function applyFilters() {
    if (!AppState.isDemoMode && AppState.data.length > 0) {
        updateMetrics();
        updateStatsBar();
    }
}

function updateStatsBar() {
    const filteredData = DataLoader.filterData(AppState.data, AppState.filters);
    const uniqueOrders = new Set(filteredData.map(d => d.uniqueOrderNo).filter(o => o)).size;

    Elements.totalOrdersEl.textContent = uniqueOrders.toLocaleString();

    // Build filter summary
    const filters = [];
    if (AppState.filters.brand && AppState.filters.brand !== 'all') {
        filters.push(AppState.filters.brand);
    }
    if (AppState.filters.locationType && AppState.filters.locationType !== 'all') {
        filters.push(AppState.filters.locationType);
    }
    if (AppState.filters.marketplaceWeb && AppState.filters.marketplaceWeb !== 'all') {
        filters.push(AppState.filters.marketplaceWeb);
    }
    if (AppState.filters.fulfillmentLocation && AppState.filters.fulfillmentLocation !== 'all') {
        filters.push(AppState.filters.fulfillmentLocation);
    }

    Elements.activeFiltersEl.textContent = filters.length > 0
        ? filters.join(' | ')
        : 'All data';
}

function updateMetrics() {
    const filteredData = DataLoader.filterData(AppState.data, AppState.filters);

    if (filteredData.length === 0) {
        showNoData();
        return;
    }

    AppState.metrics = DataLoader.calculateMetrics(filteredData);
    renderTiles();
}

function renderTiles() {
    if (!AppState.metrics) return;

    const metrics = AppState.metrics;
    const tileData = [
        {
            id: 'totalOrders',
            label: 'Total Orders',
            value: metrics.totalOrders.current,
            change: metrics.totalOrders.change,
            isHigherBetter: true,
            unit: '',
            isTime: false,
            metricKey: null
        },
        {
            id: 'o2p',
            label: 'O2P',
            value: metrics.o2p.current,
            change: metrics.o2p.change,
            isHigherBetter: false,
            unit: 'hrs',
            isTime: true,
            metricKey: 'o2p'
        },
        {
            id: 'p2s',
            label: 'P2S',
            value: metrics.p2s.current,
            change: metrics.p2s.change,
            isHigherBetter: false,
            unit: 'hrs',
            isTime: true,
            metricKey: 'p2s'
        },
        {
            id: 's2d',
            label: 'S2D',
            value: metrics.s2d.current,
            change: metrics.s2d.change,
            isHigherBetter: false,
            unit: 'hrs',
            isTime: true,
            metricKey: 's2d'
        },
        {
            id: 'o2d',
            label: 'O2D',
            value: metrics.o2d.current,
            change: metrics.o2d.change,
            isHigherBetter: false,
            unit: 'hrs',
            isTime: true,
            metricKey: 'o2d'
        },
        {
            id: 'whOrders',
            label: 'WH Orders',
            value: metrics.whOrders.current,
            change: metrics.whOrders.change,
            isHigherBetter: true,
            unit: '',
            isTime: false,
            metricKey: null
        },
        {
            id: 'storeOrders',
            label: 'Store Orders',
            value: metrics.storeOrders.current,
            change: metrics.storeOrders.change,
            isHigherBetter: true,
            unit: '',
            isTime: false,
            metricKey: null
        },
        // Days metrics
        {
            id: 'o2p_Days',
            label: 'O2P',
            value: metrics.o2p_Days.current,
            change: metrics.o2p_Days.change,
            isHigherBetter: false,
            unit: 'days',
            isTime: true,
            metricKey: 'o2p'
        },
        {
            id: 'p2s_Days',
            label: 'P2S',
            value: metrics.p2s_Days.current,
            change: metrics.p2s_Days.change,
            isHigherBetter: false,
            unit: 'days',
            isTime: true,
            metricKey: 'p2s'
        },
        {
            id: 's2d_Days',
            label: 'S2D',
            value: metrics.s2d_Days.current,
            change: metrics.s2d_Days.change,
            isHigherBetter: false,
            unit: 'days',
            isTime: true,
            metricKey: 's2d'
        },
        {
            id: 'o2d_Days',
            label: 'O2D',
            value: metrics.o2d_Days.current,
            change: metrics.o2d_Days.change,
            isHigherBetter: false,
            unit: 'days',
            isTime: true,
            metricKey: 'o2d'
        }
    ];

    Elements.tileGrid.innerHTML = tileData.map((tile, index) => {
        // Format value - show "—" for NaN
        let formattedValue;
        if (isNaN(tile.value)) {
            formattedValue = '—';
        } else {
            formattedValue = tile.isTime
                ? tile.value.toFixed(1)
                : Math.round(tile.value).toLocaleString();
        }

        // Format change - show "—" for NaN or zero
        let changeBadge = '';
        if (isNaN(tile.change) || tile.change === 0) {
            changeBadge = `<span class="change-badge neutral">— 0%</span>`;
        } else {
            const changeClass = getChangeClass(tile.change, tile.isHigherBetter);
            const changeIcon = tile.change > 0 ? '▲' : '▼';
            changeBadge = `<span class="change-badge ${changeClass}">${changeIcon} ${Math.abs(tile.change).toFixed(1)}%</span>`;
        }

        // Generate sparkline SVG
        const sparklineSVG = generateSparkline(tile.metricKey);

        return `
            <div class="metric-tile ${AppState.isDemoMode ? 'demo-tile' : ''}" data-metric="${tile.id}" data-metric-key="${tile.metricKey || ''}" style="animation-delay: ${index * 0.05}s">
                <div class="tile-header">
                    <span class="tile-label">${tile.label}</span>
                    ${changeBadge}
                </div>
                <div class="tile-value">
                    ${formattedValue}${tile.unit ? `<span class="unit">${tile.unit}</span>` : ''}
                </div>
                <div class="sparkline-container">
                    ${sparklineSVG}
                </div>
            </div>
        `;
    }).join('');

    // Add click listeners to tiles
    document.querySelectorAll('.metric-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            const metricId = tile.dataset.metric;
            const metricKey = tile.dataset.metricKey;
            openDrillDown(metricId, metricKey);
        });
    });

    // Add demo notice
    if (AppState.isDemoMode) {
        Elements.tileGrid.innerHTML += `
            <div class="demo-notice" style="grid-column: 1 / -1; text-align: center; padding: 20px; background: #fef3c7; border-radius: 8px; margin-top: 10px;">
                <strong>Demo Mode</strong> — Upload a CSV file to see actual data
            </div>
        `;
    }
}

function generateSparkline(metricKey) {
    // Show flat line for demo mode or no data
    if (AppState.isDemoMode || !metricKey) {
        return `<svg class="sparkline" viewBox="0 0 200 50" preserveAspectRatio="none">
            <line x1="0" y1="25" x2="200" y2="25" stroke="#e2e8f0" stroke-width="2"/>
        </svg>`;
    }

    const filteredData = DataLoader.filterData(AppState.data, AppState.filters);
    const dailyData = DataLoader.getDailyData(filteredData, metricKey);

    if (!dailyData.current.length && !dailyData.previous.length) {
        return `<svg class="sparkline" viewBox="0 0 200 50" preserveAspectRatio="none">
            <line x1="0" y1="25" x2="200" y2="25" stroke="#e2e8f0" stroke-width="2"/>
        </svg>`;
    }

    // Create sparkline path
    const allValues = [
        ...dailyData.current.map(d => d.avg),
        ...dailyData.previous.map(d => d.avg)
    ].filter(v => v > 0);

    if (allValues.length === 0) {
        return `<svg class="sparkline" viewBox="0 0 200 50" preserveAspectRatio="none">
            <line x1="0" y1="25" x2="200" y2="25" stroke="#e2e8f0" stroke-width="2"/>
        </svg>`;
    }

    const minVal = Math.min(...allValues) * 0.9;
    const maxVal = Math.max(...allValues) * 1.1;
    const range = maxVal - minVal || 1;

    // Previous period (grey dashed)
    const prevPath = createSparklinePath(dailyData.previous, minVal, range);

    // Current period (blue)
    const currentPath = createSparklinePath(dailyData.current, minVal, range);

    // Create gradient
    const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;

    return `
        <svg class="sparkline" viewBox="0 0 200 50" preserveAspectRatio="none">
            <defs>
                <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
                </linearGradient>
            </defs>
            ${prevPath ? `
                <path d="${prevPath.path}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>
            ` : ''}
            ${currentPath ? `
                <path d="${currentPath.path}" fill="url(#${gradientId})" stroke="#3b82f6" stroke-width="2"/>
                <path d="${currentPath.areaPath}" fill="url(#${gradientId})" stroke="none"/>
            ` : ''}
        </svg>
    `;
}

function createSparklinePath(data, minVal, range) {
    if (!data || data.length < 2) return null;

    const width = 200;
    const height = 50;
    const padding = 2;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - padding - ((d.avg - minVal) / range) * (height - padding * 2);
        return { x, y };
    });

    // Line path
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        // Smooth curve
        const prev = points[i - 1];
        const curr = points[i];
        const cpx = (prev.x + curr.x) / 2;
        path += ` Q ${cpx} ${prev.y}, ${curr.x} ${curr.y}`;
    }

    // Area path (for gradient fill)
    const areaPath = path +
        ` L ${points[points.length - 1].x} ${height}` +
        ` L ${points[0].x} ${height} Z`;

    return { path, areaPath };
}

function getChangeClass(change, isHigherBetter) {
    if (change === 0) return 'neutral';
    if (isHigherBetter) {
        return change > 0 ? 'positive' : 'negative';
    } else {
        return change < 0 ? 'positive' : 'negative';
    }
}

function openDrillDown(metricId, metricKey) {
    // Show message for demo mode
    if (AppState.isDemoMode) {
        alert('Please upload a CSV file to see drill-down data.');
        return;
    }

    const filteredData = DataLoader.filterData(AppState.data, AppState.filters);

    // Get metric info
    const metricNames = {
        totalOrders: 'Total Orders',
        o2p: 'Order to Pick (O2P) - Hours',
        p2s: 'Pick to Ship (P2S) - Hours',
        s2d: 'Ship to Delivery (S2D) - Hours',
        o2d: 'Order to Delivery (O2D) - Hours',
        whOrders: 'Warehouse Orders',
        storeOrders: 'Store Orders',
        o2p_Days: 'Order to Pick (O2P) - Days',
        p2s_Days: 'Pick to Ship (P2S) - Days',
        s2d_Days: 'Ship to Delivery (S2D) - Days',
        o2d_Days: 'Order to Delivery (O2D) - Days'
    };

    const isTimeMetric = ['o2p', 'p2s', 's2d', 'o2d', 'o2p_Days', 'p2s_Days', 's2d_Days', 'o2d_Days'].includes(metricId);
    const isCountMetric = ['totalOrders', 'whOrders', 'storeOrders'].includes(metricId);

    // Get current/previous data
    const metrics = DataLoader.calculateMetrics(filteredData);
    const metricData = metrics[metricId];

    // Get daily data
    let dailyData = null;
    let bucketData = null;

    if (metricKey) {
        dailyData = DataLoader.getDailyData(filteredData, metricKey);
        const bucketKey = `${metricKey}_H`;
        bucketData = DataLoader.getTimeBucketData(filteredData, bucketKey);
    }

    // Build modal content
    let content = `
        <div class="drill-summary">
            <div class="drill-stat">
                <div class="drill-stat-label">Current Period (14 days)</div>
                <div class="drill-stat-value">${formatMetricValue(metricData.current, isTimeMetric)}</div>
                <div class="drill-stat-change ${getChangeClass(metricData.change, metricData.isHigherBetter)}">
                    ${metricData.change > 0 ? '▲' : '▼'} ${Math.abs(metricData.change).toFixed(1)}% vs previous
                </div>
            </div>
            <div class="drill-stat">
                <div class="drill-stat-label">Previous Period (14 days)</div>
                <div class="drill-stat-value">${formatMetricValue(metricData.previous, isTimeMetric)}</div>
            </div>
        </div>
    `;

    // Daily trend chart
    if (dailyData) {
        content += `
            <div class="chart-section">
                <div class="chart-title">Daily Trend</div>
                <div class="chart-container">
                    ${generateLineChart(dailyData)}
                </div>
            </div>
        `;
    }

    // Time bucket chart (for time metrics)
    if (isTimeMetric && bucketData) {
        content += `
            <div class="chart-section">
                <div class="chart-title">Time Distribution</div>
                <div class="chart-container">
                    ${generateBarChart(bucketData)}
                </div>
            </div>
        `;
    }

    // Daily breakdown table
    if (dailyData && dailyData.current.length > 0) {
        const tableRows = dailyData.current.map(d => `
            <tr>
                <td>${formatDateDisplay(d.date)}</td>
                <td>${isTimeMetric ? d.avg.toFixed(2) + ' hrs' : d.count}</td>
                <td>${d.count}</td>
            </tr>
        `).join('');

        content += `
            <div class="chart-section">
                <div class="chart-title">Daily Breakdown</div>
                <table class="daily-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Avg ${isTimeMetric ? '(hrs)' : ''}</th>
                            <th>Orders</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    }

    Elements.modalTitle.textContent = metricNames[metricId] || metricId;
    Elements.modalBody.innerHTML = content;
    Elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function formatMetricValue(value, isTime) {
    if (isNaN(value)) return '—';
    if (isTime) {
        return value.toFixed(1) + ' hrs';
    }
    return Math.round(value).toLocaleString();
}

function formatDateDisplay(date) {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function generateLineChart(dailyData) {
    const width = 600;
    const height = 180;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };

    // Combine all values for scaling
    const allValues = [
        ...dailyData.current.map(d => d.avg),
        ...dailyData.previous.map(d => d.avg)
    ].filter(v => v > 0);

    if (allValues.length === 0) {
        return '<p style="text-align:center;color:#64748b">No data available</p>';
    }

    const minVal = Math.min(...allValues) * 0.9;
    const maxVal = Math.max(...allValues) * 1.1;
    const range = maxVal - minVal || 1;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Create scales
    const maxDate = dailyData.current.length > 0
        ? dailyData.current[dailyData.current.length - 1].date
        : new Date();
    const minDate = dailyData.current.length > 0
        ? dailyData.current[0].date
        : new Date();

    if (dailyData.previous.length > 0) {
        const prevMin = dailyData.previous[0].date;
        const prevMax = dailyData.previous[dailyData.previous.length - 1].date;
        if (prevMin < minDate) minDate = prevMin;
        if (prevMax > maxDate) maxDate = prevMax;
    }

    const dateRange = maxDate - minDate || 1;

    const xScale = (date) => padding.left + ((date - minDate) / dateRange) * chartWidth;
    const yScale = (val) => padding.top + chartHeight - ((val - minVal) / range) * chartHeight;

    // Previous line (dashed)
    let prevPath = '';
    if (dailyData.previous.length > 1) {
        prevPath = `M ${xScale(dailyData.previous[0].date)} ${yScale(dailyData.previous[0].avg)}`;
        for (let i = 1; i < dailyData.previous.length; i++) {
            const curr = dailyData.previous[i];
            prevPath += ` L ${xScale(curr.date)} ${yScale(curr.avg)}`;
        }
    }

    // Current line (solid)
    let currentPath = '';
    if (dailyData.current.length > 1) {
        currentPath = `M ${xScale(dailyData.current[0].date)} ${yScale(dailyData.current[0].avg)}`;
        for (let i = 1; i < dailyData.current.length; i++) {
            const curr = dailyData.current[i];
            currentPath += ` L ${xScale(curr.date)} ${yScale(curr.avg)}`;
        }
    }

    // Y-axis labels
    const yTicks = 5;
    let yLabels = '';
    for (let i = 0; i <= yTicks; i++) {
        const val = minVal + (range * i / yTicks);
        const y = yScale(val);
        yLabels += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748b">${val.toFixed(1)}</text>`;
    }

    return `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
            <!-- Grid lines -->
            ${Array.from({ length: yTicks + 1 }, (_, i) => {
                const y = padding.top + (chartHeight * i / yTicks);
                return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
            }).join('')}

            <!-- Y-axis labels -->
            ${yLabels}

            <!-- Previous period (grey dashed) -->
            ${prevPath ? `<path d="${prevPath}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 4" opacity="0.7"/>` : ''}

            <!-- Current period (blue) -->
            ${currentPath ? `<path d="${currentPath}" fill="none" stroke="#3b82f6" stroke-width="2.5"/>` : ''}

            <!-- Data points -->
            ${dailyData.current.map(d => `
                <circle cx="${xScale(d.date)}" cy="${yScale(d.avg)}" r="3" fill="#3b82f6"/>
            `).join('')}

            <!-- Legend -->
            <line x1="${width - 120}" y1="15" x2="${width - 100}" y2="15" stroke="#3b82f6" stroke-width="2"/>
            <text x="${width - 95}" y="19" font-size="10" fill="#64748b">Current</text>
            <line x1="${width - 60}" y1="15" x2="${width - 40}" y2="15" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 4"/>
            <text x="${width - 35}" y="19" font-size="10" fill="#64748b">Previous</text>
        </svg>
    `;
}

function generateBarChart(bucketData) {
    const maxCount = Math.max(...bucketData.map(b => b.count), 1);
    const height = 150;

    return `
        <div class="bar-chart">
            ${bucketData.map(bucket => {
                const barHeight = (bucket.count / maxCount) * height;
                return `
                    <div class="bar-item">
                        <div class="bar-value">${bucket.count}</div>
                        <div class="bar" style="height: ${barHeight}px;"></div>
                        <div class="bar-label">${bucket.name}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function closeModal() {
    Elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function showLoading() {
    Elements.tileGrid.innerHTML = `
        <div class="loading" style="grid-column: 1 / -1;">
            <div class="spinner"></div>
        </div>
    `;
}

function showNoData() {
    Elements.tileGrid.innerHTML = `
        <div class="no-data" style="grid-column: 1 / -1;">
            <div class="no-data-icon">📊</div>
            <h3>No data in range</h3>
            <p>Try adjusting your filters or date range</p>
        </div>
    `;
}