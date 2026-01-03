const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'hackathon-secret-key';

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to verify token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const crypto = require('crypto');

/* --- AUTH ROUTES --- */

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // For security, do not reveal if user exists, but for demo we will.
            // In prod: return res.json({ message: 'If account exists, email sent.' });
            return res.status(404).json({ error: 'User not found' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        await prisma.user.update({
            where: { email },
            data: { resetToken: token, resetTokenExpiry: expiry }
        });

        // DEMO ONLY: Log the link
        const resetLink = `http://localhost:3000/reset-password.html?token=${token}`;
        console.log(`[DEMO] Reset Link for ${email}: ${resetLink}`);

        res.json({ message: 'Reset link sent to console (Demo mode)', link: resetLink });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: { gt: new Date() }
            }
        });

        if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        res.json({ message: 'Password reset successful' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/signup', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name }
        });
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (e) {
        res.status(400).json({ error: 'Email likely already exists' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'User not found' });

    if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } else {
        res.status(403).json({ error: 'Invalid password' });
    }
});

/* --- TRIP ROUTES --- */

// Get all trips for user
app.get('/api/trips', authenticateToken, async (req, res) => {
    const trips = await prisma.trip.findMany({
        where: { userId: req.user.userId },
        orderBy: { startDate: 'desc' },
        include: { stops: { include: { city: true, stopActivities: { include: { activity: true } } } } }
    });
    res.json(trips);
});

// Create new trip
app.post('/api/trips', authenticateToken, async (req, res) => {
    const { name, startDate, endDate, description } = req.body;
    try {
        const trip = await prisma.trip.create({
            data: {
                userId: req.user.userId,
                name,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                description
            }
        });
        res.json(trip);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create trip' });
    }
});

// Get single trip details
app.get('/api/trips/:id', authenticateToken, async (req, res) => {
    const trip = await prisma.trip.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { stops: { include: { city: { include: { activities: true } }, stopActivities: { include: { activity: true } } } } }
    });
    if (!trip || trip.userId !== req.user.userId) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
});

/* --- DATA ROUTES --- */
app.get('/api/cities', async (req, res) => {
    const cities = await prisma.city.findMany({
        include: { activities: true }
    });
    res.json(cities);
});

// Proxy for Teleport API to fix CORS/Network issues
app.get('/api/proxy/cities', async (req, res) => {
    const query = req.query.search;
    if (!query) return res.status(400).json({ error: 'Search query required' });

    try {
        const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
        // Fallback to native fetch if available (Node 18+) or use dynamic import above if installed, 
        // but since we don't have node-fetch installed and user environmental is unknown, we use https module.
        // Actually, simplest is to use built-in fetch if Node >= 18.
        // Let's rely on global fetch if available, else standard https.

        // Safer implementation with 'https' module to have zero dependencies
        const https = require('https');
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;

        https.get(url, (apiRes) => {
            let data = '';
            apiRes.on('data', bit => data += bit);
            apiRes.on('end', () => {
                try {
                    res.json(JSON.parse(data));
                } catch (e) {
                    res.status(500).json({ error: 'Failed to parse external API response' });
                }
            });
        }).on('error', (e) => {
            console.error(e);
            res.status(500).json({ error: 'Failed to fetch from external API' });
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Proxy server error' });
    }
});

// Check/Create City (Dynamic from Teleport API)
app.post('/api/cities/ensure', async (req, res) => {
    const { name, country, description } = req.body;
    try {
        let city = await prisma.city.findFirst({
            where: { name: name, country: country }
        });

        if (!city) {
            // Create new city
            // Mocking cost/activities for now as API might not return exact format we want easily
            city = await prisma.city.create({
                data: {
                    name,
                    country,
                    description: description || 'Discovered destination',
                    avgDailyCost: Math.floor(Math.random() * 200) + 100 // Randomized Mock Cost
                }
            });

            // Add some default activities for this new city
            await prisma.activity.createMany({
                data: [
                    { cityId: city.id, name: 'City Center Tour', category: 'Sightseeing', cost: 0 },
                    { cityId: city.id, name: 'Local Cuisine', category: 'Food', cost: 40 },
                    { cityId: city.id, name: 'Museum Visit', category: 'Culture', cost: 25 },
                ]
            });
        }
        res.json(city);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to ensure city' });
    }
});

// Create Custom/Personal Activity
app.post('/api/stops/:stopId/custom-activity', authenticateToken, async (req, res) => {
    const { name, cost, category } = req.body;
    const stopId = parseInt(req.params.stopId);

    try {
        const stop = await prisma.stop.findUnique({ where: { id: stopId } });
        if (!stop) return res.status(404).json({ error: 'Stop not found' });

        // Create new Activity linked to City
        const activity = await prisma.activity.create({
            data: {
                cityId: stop.cityId,
                name,
                cost: parseFloat(cost) || 0,
                category: category || 'Personal'
            }
        });

        // Link to Stop
        const stopActivity = await prisma.stopActivity.create({
            data: {
                stopId: stopId,
                activityId: activity.id
            },
            include: { activity: true }
        });

        res.json(stopActivity);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to add custom activity' });
    }
});

// Add stop to trip
app.post('/api/trips/:id/stops', authenticateToken, async (req, res) => {
    const { cityId, startDate, endDate, orderIndex } = req.body;
    try {
        const stop = await prisma.stop.create({
            data: {
                tripId: parseInt(req.params.id),
                cityId: parseInt(cityId),
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                orderIndex: parseInt(orderIndex)
            }
        });
        res.json(stop);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to add stop' });
    }
});

// Add activity to stop
app.post('/api/stops/:stopId/activities', authenticateToken, async (req, res) => {
    const { activityId } = req.body;
    try {
        const stopActivity = await prisma.stopActivity.create({
            data: {
                stopId: parseInt(req.params.stopId),
                activityId: parseInt(activityId)
            }
        });
        res.json(stopActivity);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to add activity' });
    }
});

// Remove activity from stop
app.delete('/api/stop-activities/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.stopActivity.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove activity' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
