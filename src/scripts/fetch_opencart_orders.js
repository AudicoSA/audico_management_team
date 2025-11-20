/**
 * Fetch OpenCart Orders using axios (bypasses Python TLS issues)
 */
const axios = require('axios');
const path = require('path');

// Load .env from project root
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
// Fallback to parent .env if needed
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const OPENCART_BASE_URL = process.env.OPENCART_BASE_URL || 'https://www.audicoonline.co.za';
const OPENCART_CLIENT_ID = process.env.OPENCART_CLIENT_ID;
const OPENCART_CLIENT_SECRET = process.env.OPENCART_CLIENT_SECRET;
const OPENCART_ADMIN_USERNAME = process.env.OPENCART_ADMIN_USERNAME;
const OPENCART_ADMIN_PASSWORD = process.env.OPENCART_ADMIN_PASSWORD;

async function fetchOrders() {
    try {
        // 1. Get Access Token
        const basic = Buffer.from(`${OPENCART_CLIENT_ID}:${OPENCART_CLIENT_SECRET}`).toString('base64');
        const tokenUrl = `${OPENCART_BASE_URL}/index.php?route=rest/admin_security/gettoken&grant_type=client_credentials`;

        const tokenResponse = await axios.post(tokenUrl, null, {
            headers: { Authorization: `Basic ${basic}` },
            validateStatus: () => true,
        });

        if (tokenResponse.status !== 200) {
            throw new Error(`Token failed (${tokenResponse.status})`);
        }

        const token = tokenResponse.data?.data?.access_token || tokenResponse.data?.access_token;
        if (!token) throw new Error('Missing access_token');

        // 2. Admin Login
        const loginUrl = `${OPENCART_BASE_URL}/index.php?route=rest/admin_security/login`;
        await axios.post(
            loginUrl,
            { username: OPENCART_ADMIN_USERNAME, password: OPENCART_ADMIN_PASSWORD },
            {
                headers: { Authorization: `Bearer ${token}` },
                validateStatus: () => true,
            }
        );

        // 3. Fetch Orders
        // Get limit from args or default to 50
        const requestedLimit = parseInt(process.argv[2] || 50);
        const ordersUrl = `${OPENCART_BASE_URL}/index.php?route=rest/order_admin/orders`;

        // OpenCart API doesn't sort properly, so we need to use pagination
        // to skip old orders and get to recent ones
        // Assuming there are ~28000+ orders, start from a high offset
        const response = await axios.get(ordersUrl, {
            params: {
                start: 28500,  // Skip to recent orders (adjust based on total count)
                limit: requestedLimit
            },
            headers: { Authorization: `Bearer ${token}` },
            validateStatus: () => true,
        });

        if (response.status !== 200) {
            throw new Error(`Fetch failed (${response.status})`);
        }

        // Sort by order_id descending (newest first)
        let orders = response.data?.data || [];
        orders = orders.sort((a, b) => parseInt(b.order_id) - parseInt(a.order_id));

        // Output JSON with sorted orders
        console.log(JSON.stringify({ success: 1, error: [], data: orders }));

    } catch (error) {
        console.error(`ERROR: ${error.message}`);
        process.exit(1);
    }
}

fetchOrders();
