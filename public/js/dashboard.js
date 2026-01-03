document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    document.getElementById('user-name').textContent = user.name;
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    loadTrips();
});

async function loadTrips() {
    const tripList = document.getElementById('trip-list');
    tripList.innerHTML = '<p>Loading trips...</p>';

    try {
        const trips = await API.request('/trips');
        tripList.innerHTML = '';

        if (trips.length === 0) {
            tripList.innerHTML = `
                <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <h3>No trips found</h3>
                    <p class="mb-4">Start planning your next adventure!</p>
                    <a href="create-trip.html" class="btn btn-primary">Plan New Trip</a>
                </div>
            `;
            // Still load recommendations even if no trips
            loadRecommendations();
            return;
        }

        trips.forEach(trip => {
            const startDate = new Date(trip.startDate).toLocaleDateString();

            // Calculate Total Cost
            let totalCost = 0;
            if (trip.stops) {
                trip.stops.forEach(stop => {
                    const days = Math.ceil((new Date(stop.endDate) - new Date(stop.startDate)) / (1000 * 60 * 60 * 24));
                    const activitiesCost = stop.stopActivities.reduce((acc, sa) => acc + sa.activity.cost, 0);
                    const stayCost = days * stop.city.avgDailyCost;
                    totalCost += (stayCost + activitiesCost);
                });
            }

            const card = document.createElement('div');
            card.className = 'card trip-card';
            card.onclick = () => window.location.href = `trip.html?id=${trip.id}`;
            card.innerHTML = `
                <h3>${trip.name}</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">${startDate}</p>
                <div class="mt-4">
                    <span style="font-size: 1.25rem; font-weight: bold; color: var(--primary);">$${totalCost}</span>
                    <span class="text-muted" style="font-size: 0.8rem;">Est. Cost</span>
                </div>
                <p class="mt-2" style="font-size: 0.9rem;">${trip.description || 'No description'}</p>
                <div class="mt-4 flex justify-between items-center">
                    <span class="btn btn-outline" style="font-size: 0.8rem;">View Itinerary</span>
                </div>
            `;
            tripList.appendChild(card);
        });

        loadRecommendations();
    } catch (err) {
        console.error(err);
        tripList.innerHTML = '<p style="color: red">Failed to load trips.</p>';
    }
}

async function loadRecommendations() {
    const recList = document.getElementById('recommended-list');
    if (!recList) return;

    try {
        const cities = await API.request('/cities');
        // Just show first 3 as recommendations for now
        const recommended = cities.slice(0, 3);

        recList.innerHTML = '';
        recommended.forEach(city => {
            const card = document.createElement('div');
            card.className = 'card trip-card';
            // Placeholder images based on city name for demo vibe
            let imgUrl = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=600&q=80';
            if (city.name === 'Paris') imgUrl = 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80';
            if (city.name === 'Tokyo') imgUrl = 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80';
            if (city.name === 'New York') imgUrl = 'https://images.unsplash.com/photo-1520106212299-d99c443e4568?auto=format&fit=crop&w=600&q=80';

            card.innerHTML = `
                <img src="${imgUrl}" style="width:100%; height: 150px; object-fit: cover; border-radius: 4px;">
                <h3 class="mt-2">${city.name}, ${city.country}</h3>
                <p class="text-muted">$${city.avgDailyCost}/day avg.</p>
                <button onclick="window.location.href='create-trip.html'" class="btn btn-primary mt-2" style="width:100%">Plan a Trip</button>
            `;
            recList.appendChild(card);
        });
    } catch (e) {
        console.error(e);
        recList.innerHTML = '<p>Could not load recommendations.</p>';
    }
}
