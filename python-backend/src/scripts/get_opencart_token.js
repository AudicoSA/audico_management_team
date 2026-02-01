/**
 * Fetch OpenCart Bearer Token using axios (bypasses Python TLS issues)
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

async function getBearerToken() {
    try {
        // 1. Get Access Token
        const basic = Buffer.from(`${OPENCART_CLIENT_ID}:${OPENCART_CLIENT_SECRET}`).toString('base64');
        const url = `${OPENCART_BASE_URL}/index.php?route=rest/admin_security/gettoken&grant_type=client_credentials`;

        const response = await axios.post(url, null, {
            headers: { Authorization: `Basic ${basic}` },
            validateStatus: () => true,
        });

        if (response.status !== 200) {
            throw new Error(`Token failed (${response.status}): ${JSON.stringify(response.data)}`);
        }

        const token = response.data?.data?.access_token || response.data?.access_token;
        if (!token) throw new Error('Missing access_token in response');

        // 2. Admin Login
        const loginUrl = `${OPENCART_BASE_URL}/index.php?route=rest/admin_security/login`;
        const loginResponse = await axios.post(
            loginUrl,
            { username: OPENCART_ADMIN_USERNAME, password: OPENCART_ADMIN_PASSWORD },
            {
                headers: { Authorization: `Bearer ${token}` },
                validateStatus: () => true,
            }
        );

        if (loginResponse.status !== 200 || !loginResponse.data?.success) {
            throw new Error(`Admin login failed: ${JSON.stringify(loginResponse.data)}`);
        }

        // Output ONLY the token
        console.log(token);

    } catch (error) {
        console.error(`ERROR: ${error.message}`);
        process.exit(1);
    }
}

getBearerToken();
