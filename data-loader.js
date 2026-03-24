/**
 * Data Loader - CSV parsing with positional column mapping
 */

const DataLoader = {
    // Column positions (0-indexed) - verified from actual CSV
    COLUMNS: {
        BRAND: 0,               // channel code (brand)
        ORDER_DATE: 6,          // date (dd-mm-yyyy or m/d/yyyy)
        LOCATION_TYPE: 40,      // location type (WH or STORE)
        MARKETPLACE_WEB: 83,    // marketplace/web (Marketplace or Web)
        FULFILLMENT_LOCATION: 36, // fullfilment location name
        O2P: 107,               // o2p (hours)
        P2S: 108,               // p2s (hours)
        S2D: 109,               // s2d (hours)
        O2D: 110,               // o2d (hours)
        O2P_H: 111,             // o2p_H bucket (0-6Hrs, etc.)
        P2S_H: 112,             // p2s_H bucket
        S2D_H: 113,             // s2d_H bucket
        O2D_H: 114,             // o2d_H bucket
        UNIQUE_ORDER_NO: 4      // unique external order no
    },

    /**
     * Parse date from various formats (dd-mm-yyyy, m/d/yyyy, or datetime)
     */
    parseDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;

        dateStr = dateStr.trim();

        // Handle datetime formats like "02-05-2026 05:37" or "3/19/2026 14:36"
        // Extract just the date part first
        let datePart = dateStr;

        // If it has time, extract just the date portion
        if (dateStr.includes(' ') || dateStr.includes('T')) {
            datePart = dateStr.split(/[\sT]/)[0];
        }

        // Try dd-mm-yyyy format
        let match = datePart.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (match) {
            return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        }

        // Try m/d/yyyy format
        match = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) {
            return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        }

        // Try standard Date parse
        const parsed = new Date(datePart);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }

        return null;
    },

    /**
     * Parse CSV line handling quoted fields
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());

        return result;
    },

    /**
     * Parse entire CSV file
     */
    parseCSV(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) return [];

        const data = [];
        const headers = this.parseCSVLine(lines[0]);

        for (let i = 1; i < lines.length; i++) {
            const row = this.parseCSVLine(lines[i]);
            if (row.length <= Math.max(...Object.values(this.COLUMNS))) continue;

            const record = {
                brand: row[this.COLUMNS.BRAND] || '',
                orderDate: this.parseDate(row[this.COLUMNS.ORDER_DATE]),
                locationType: row[this.COLUMNS.LOCATION_TYPE] || '',
                marketplaceWeb: row[this.COLUMNS.MARKETPLACE_WEB] || '',
                fulfillmentLocation: row[this.COLUMNS.FULFILLMENT_LOCATION] || '',
                o2p: parseFloat(row[this.COLUMNS.O2P]) || 0,
                p2s: parseFloat(row[this.COLUMNS.P2S]) || 0,
                s2d: parseFloat(row[this.COLUMNS.S2D]) || 0,
                o2d: parseFloat(row[this.COLUMNS.O2D]) || 0,
                o2p_H: row[this.COLUMNS.O2P_H] || '',
                p2s_H: row[this.COLUMNS.P2S_H] || '',
                s2d_H: row[this.COLUMNS.S2D_H] || '',
                o2d_H: row[this.COLUMNS.O2D_H] || '',
                uniqueOrderNo: row[this.COLUMNS.UNIQUE_ORDER_NO] || ''
            };

            if (record.orderDate && !isNaN(record.o2p)) {
                data.push(record);
            }
        }

        return data;
    },

    /**
     * Get unique brands from data
     */
    getBrands(data) {
        const brands = [...new Set(data.map(d => d.brand).filter(b => b))];
        return brands.sort();
    },

    /**
     * Get unique marketplace/web values from data
     */
    getMarketplaces(data) {
        const marketplaces = [...new Set(data.map(d => d.marketplaceWeb).filter(m => m))];
        return marketplaces.sort();
    },

    /**
     * Get unique fulfillment location names from data
     */
    getFulfillmentLocations(data) {
        const locations = [...new Set(data.map(d => d.fulfillmentLocation).filter(l => l))];
        return locations.sort();
    },

    /**
     * Get date range from data
     */
    getDateRange(data) {
        if (!data.length) return { min: null, max: null };

        const dates = data.map(d => d.orderDate).filter(d => d);
        return {
            min: new Date(Math.min(...dates)),
            max: new Date(Math.max(...dates))
        };
    },

    /**
     * Filter data by brand, location type, and date range
     */
    filterData(data, filters) {
        return data.filter(record => {
            // Brand filter
            if (filters.brand && filters.brand !== 'all' && record.brand !== filters.brand) {
                return false;
            }

            // Location type filter
            if (filters.locationType && filters.locationType !== 'all' && record.locationType !== filters.locationType) {
                return false;
            }

            // Marketplace/Web filter
            if (filters.marketplaceWeb && filters.marketplaceWeb !== 'all' && record.marketplaceWeb !== filters.marketplaceWeb) {
                return false;
            }

            // Fulfillment location filter
            if (filters.fulfillmentLocation && filters.fulfillmentLocation !== 'all' && record.fulfillmentLocation !== filters.fulfillmentLocation) {
                return false;
            }

            // Date range filter
            if (filters.startDate && record.orderDate < filters.startDate) {
                return false;
            }
            if (filters.endDate && record.orderDate > filters.endDate) {
                return false;
            }

            return true;
        });
    },

    /**
     * Split data into current and previous periods
     */
    splitByPeriod(data, days = 14) {
        if (!data.length) return { current: [], previous: [] };

        const dates = data.map(d => d.orderDate).filter(d => d);
        const maxDate = new Date(Math.max(...dates));
        const minDate = new Date(Math.min(...dates));

        const currentStart = new Date(maxDate);
        currentStart.setDate(currentStart.getDate() - days + 1);

        const previousEnd = new Date(currentStart);
        previousEnd.setDate(previousEnd.getDate() - 1);

        const previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - days + 1);

        const current = data.filter(d => d.orderDate >= currentStart && d.orderDate <= maxDate);
        const previous = data.filter(d => d.orderDate >= previousStart && d.orderDate <= previousEnd);

        return { current, previous };
    },

    /**
     * Calculate metrics for current and previous periods
     */
    calculateMetrics(data) {
        const { current, previous } = this.splitByPeriod(data, 14);

        // Helper to calculate average
        const avg = (arr, key) => {
            if (!arr.length) return 0;
            const sum = arr.reduce((s, r) => s + (r[key] || 0), 0);
            return sum / arr.length;
        };

        // Helper to count unique orders
        const uniqueOrders = (arr) => {
            const orders = new Set(arr.map(r => r.uniqueOrderNo).filter(o => o));
            return orders.size;
        };

        // Helper to count by location type
        const countByLocation = (arr, type) => {
            return arr.filter(r => r.locationType === type).length;
        };

        // Get unique orders for current and previous
        const currentUniqueOrders = new Set(current.map(r => r.uniqueOrderNo).filter(o => o));
        const previousUniqueOrders = new Set(previous.map(r => r.uniqueOrderNo).filter(o => o));

        // Calculate % change
        const calcChange = (curr, prev) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        return {
            totalOrders: {
                current: currentUniqueOrders.size,
                previous: previousUniqueOrders.size,
                change: calcChange(currentUniqueOrders.size, previousUniqueOrders.size),
                isHigherBetter: true
            },
            o2p: {
                current: avg(current, 'o2p'),
                previous: avg(previous, 'o2p'),
                change: calcChange(avg(current, 'o2p'), avg(previous, 'o2p')),
                isHigherBetter: false
            },
            p2s: {
                current: avg(current, 'p2s'),
                previous: avg(previous, 'p2s'),
                change: calcChange(avg(current, 'p2s'), avg(previous, 'p2s')),
                isHigherBetter: false
            },
            s2d: {
                current: avg(current, 's2d'),
                previous: avg(previous, 's2d'),
                change: calcChange(avg(current, 's2d'), avg(previous, 's2d')),
                isHigherBetter: false
            },
            o2d: {
                current: avg(current, 'o2d'),
                previous: avg(previous, 'o2d'),
                change: calcChange(avg(current, 'o2d'), avg(previous, 'o2d')),
                isHigherBetter: false
            },
            whOrders: {
                current: countByLocation(current, 'WH'),
                previous: countByLocation(previous, 'WH'),
                change: calcChange(countByLocation(current, 'WH'), countByLocation(previous, 'WH')),
                isHigherBetter: true
            },
            storeOrders: {
                current: countByLocation(current, 'STORE'),
                previous: countByLocation(previous, 'STORE'),
                change: calcChange(countByLocation(current, 'STORE'), countByLocation(previous, 'STORE')),
                isHigherBetter: true
            },
            // Days metrics (calculated from hours / 24)
            o2p_Days: {
                current: avg(current, 'o2p') / 24,
                previous: avg(previous, 'o2p') / 24,
                change: calcChange(avg(current, 'o2p'), avg(previous, 'o2p')),
                isHigherBetter: false
            },
            p2s_Days: {
                current: avg(current, 'p2s') / 24,
                previous: avg(previous, 'p2s') / 24,
                change: calcChange(avg(current, 'p2s'), avg(previous, 'p2s')),
                isHigherBetter: false
            },
            s2d_Days: {
                current: avg(current, 's2d') / 24,
                previous: avg(previous, 's2d') / 24,
                change: calcChange(avg(current, 's2d'), avg(previous, 's2d')),
                isHigherBetter: false
            },
            o2d_Days: {
                current: avg(current, 'o2d') / 24,
                previous: avg(previous, 'o2d') / 24,
                change: calcChange(avg(current, 'o2d'), avg(previous, 'o2d')),
                isHigherBetter: false
            }
        };
    },

    /**
     * Get daily data for sparkline and charts
     */
    getDailyData(data, metricKey, days = 14) {
        const { current, previous } = this.splitByPeriod(data, days);

        const groupByDate = (records) => {
            const groups = {};
            records.forEach(r => {
                const dateKey = r.orderDate.toISOString().split('T')[0];
                if (!groups[dateKey]) {
                    groups[dateKey] = { values: [], orders: new Set() };
                }
                groups[dateKey].values.push(r[metricKey] || 0);
                groups[dateKey].orders.add(r.uniqueOrderNo);
            });

            const result = [];
            for (const date in groups) {
                const values = groups[date].values;
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                result.push({
                    date: new Date(date),
                    avg: avg,
                    count: groups[date].orders.size
                });
            }
            return result.sort((a, b) => a.date - b.date);
        };

        return {
            current: groupByDate(current),
            previous: groupByDate(previous)
        };
    },

    /**
     * Get time bucket distribution
     */
    getTimeBucketData(data, bucketKey) {
        const buckets = { '0-6Hrs': 0, '6-12Hrs': 0, '12-24Hrs': 0, '24+Hrs': 0 };
        const bucketCounts = { '0-6Hrs': 0, '6-12Hrs': 0, '12-24Hrs': 0, '24+Hrs': 0 };

        data.forEach(r => {
            const bucket = r[bucketKey];
            if (buckets[bucket] !== undefined) {
                buckets[bucket]++;
            }
        });

        return Object.entries(buckets).map(([name, count]) => ({
            name,
            count,
            percentage: data.length > 0 ? (count / data.length) * 100 : 0
        }));
    },

    /**
     * Get default date range (last 14 days)
     */
    getDefaultDateRange() {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 13);

        return { start, end };
    },

    /**
     * Get previous period date range
     */
    getPreviousPeriodRange(days = 14) {
        const end = new Date();
        end.setDate(end.getDate() - 1);

        const start = new Date(end);
        start.setDate(start.getDate() - days + 1);

        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);

        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - days + 1);

        return {
            current: { start, end },
            previous: { start: prevStart, end: prevEnd }
        };
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataLoader;
}