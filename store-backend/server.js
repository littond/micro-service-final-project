// server.js
// Express proxy server to forward requests to your AWS API and avoid CORS issues

const express = require('express');
const cors = require('cors');

// Base URL for your API Gateway
const API_BASE = process.env.API_BASE || 'https://uphgj03fd7.execute-api.us-east-1.amazonaws.com';

const app = express();
app.use(cors());             // Enable CORS for all routes
app.use(express.json());     // Parse JSON bodies

// GET /catalog -> proxies to GET /catalog (no body)
app.get('/catalog', async (req, res) => {
    try {
        const awsRes = await fetch(`${API_BASE}/catalog`);
        const data = await awsRes.json();
        res.json(data);
    } catch (err) {
        console.error('Error fetching catalog:', err);
        res.status(500).json({ message: 'Error fetching catalog' });
    }
});

// GET /report?mode=inventory|sales -> proxies to POST /report with JSON body
app.get('/report', async (req, res) => {
    const mode = req.query.mode;
    console.log(mode);
    if (!['inventory', 'sales'].includes(mode)) {
        return res.status(400).json({ message: 'Invalid mode' });
    }

    try {
        // API Gateway /report expects a POST with JSON body
        const awsRes = await fetch(`${API_BASE}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
        const data = await awsRes.json();
        res.json(data);
    } catch (err) {
        console.error('Error fetching report:', err);
        res.status(500).json({ message: 'Error fetching report' });
    }
});

// POST /order -> proxies to POST /order
app.post('/order', async (req, res) => {
    const { product, quantity } = req.body;
    try {
        const awsRes = await fetch(`${API_BASE}/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product, quantity })
        });
        const data = await awsRes.json();
        res.json(data);
    } catch (err) {
        console.error('Error placing order:', err);
        res.status(500).json({ message: 'Error placing order' });
    }
});

// PUT /inventory -> proxies to PUT /inventory
app.put('/inventory', async (req, res) => {
    const { product, category, description, cost, quantity } = req.body;
    try {
        const awsRes = await fetch(`${API_BASE}/inventory`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product, category, description, cost, quantity })
        });
        const data = await awsRes.json();
        res.json(data);
    } catch (err) {
        console.error('Error adding inventory:', err);
        res.status(500).json({ message: 'Error adding inventory' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));

/*
  To install dependencies:
    npm install express cors node-fetch

  To run:
    node server.js

  Your frontend can now call http://localhost:3000/catalog, /report?mode=inventory, etc., without CORS errors.
*/
