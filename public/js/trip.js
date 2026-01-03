const urlParams = new URLSearchParams(window.location.search);
const tripId = urlParams.get('id');

let currentTrip = null;
let allCities = [];
let budgetChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!tripId) {
        window.location.href = 'dashboard.html';
        return;
    }

    await loadCities();
    await loadTrip();
});

async function loadCities() {
    // Deprecated load of all cities, we use search now.
    // Keeping function structure if needed for init, but leaving empty or just verifying connection.
}

async function loadTrip() {
    try {
        currentTrip = await API.request(`/trips/${tripId}`);
        // Render Header
        document.getElementById('trip-name').textContent = currentTrip.name;
        document.getElementById('trip-dates').textContent = `${new Date(currentTrip.startDate).toLocaleDateString()} - ${new Date(currentTrip.endDate).toLocaleDateString()}`;
        document.getElementById('trip-desc').textContent = currentTrip.description || 'No description.';

        renderStops();
        renderBudgetChart();
    } catch (e) {
        console.error(e);
        alert('Error loading trip');
    }
}

function renderStops() {
    const list = document.getElementById('stops-list');
    list.innerHTML = '';

    const sortedStops = currentTrip.stops.sort((a, b) => a.orderIndex - b.orderIndex);

    sortedStops.forEach((stop, index) => {
        const days = Math.ceil((new Date(stop.endDate) - new Date(stop.startDate)) / (1000 * 60 * 60 * 24));

        // Calculate total cost including activities
        const activitiesCost = stop.stopActivities.reduce((acc, sa) => acc + sa.activity.cost, 0);
        const stayCost = days * stop.city.avgDailyCost;
        const totalStopCost = stayCost + activitiesCost;

        // Prepare activities list
        const addedActivityIds = new Set(stop.stopActivities.map(sa => sa.activity.id));
        // No longer need fullCity lookup from allCities map, data is nested in stop.city


        let activitiesHtml = '';
        if (stop.stopActivities.length > 0) {
            activitiesHtml = stop.stopActivities.map(sa => `
                <div class="flex justify-between items-center" style="font-size: 0.9rem; border-bottom: 1px solid #eee; padding: 4px 0;">
                    <span>${sa.activity.name} ($${sa.activity.cost})</span>
                    <div class="flex gap-2">
                        <button onclick="editActivity(${sa.id}, '${sa.activity.name}', ${sa.activity.cost}, '${sa.activity.category}')" style="color: var(--primary); background:none; border:none; cursor:pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                        <button onclick="removeActivity(${sa.id})" style="color: red; background:none; border:none; cursor:pointer;" title="Remove">&times;</button>
                    </div>
                </div>
            `).join('');
        } else {
            activitiesHtml = '<small class="text-muted">No activities added.</small>';
        }

        let addActivitySelect = '';
        const available = stop.city?.activities?.filter(a => !addedActivityIds.has(a.id)) || [];

        // Always show Custom Activity inputs + Dropdown if existing activities
        addActivitySelect = `
            <div class="mt-2" style="border-top: 1px dashed #ccc; padding-top: 0.5rem;">
                <label style="font-size: 0.8rem; font-weight: bold;">Add Activity</label>
                <div class="flex gap-2 mb-2">
                     <select id="act-select-${stop.id}" class="bg-input" style="margin:0; padding: 0.25rem; flex: 1;">
                        <option value="">Select Existing...</option>
                        ${available.map(a => `<option value="${a.id}">${a.name} ($${a.cost})</option>`).join('')}
                    </select>
                    <button onclick="addActivity(${stop.id})" class="btn btn-outline" style="padding: 0.25rem 0.5rem;">Add</button>
                </div>
                
                <div style="font-size: 0.8rem; margin-bottom: 4px;">Or Custom:</div>
                <div class="flex gap-2">
                    <input type="text" id="cust-act-name-${stop.id}" class="bg-input" placeholder="Name (e.g. Visit Grandma)" style="margin:0; padding: 0.25rem; flex: 2;">
                    <input type="number" id="cust-act-cost-${stop.id}" class="bg-input" placeholder="Cost" style="margin:0; padding: 0.25rem; flex: 1;">
                    <button onclick="addCustomActivity(${stop.id})" class="btn btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Create</button>
                </div>
            </div>
        `;

        const card = document.createElement('div');
        card.className = 'card stop-card';
        card.innerHTML = `
            <div class="stop-order">${index + 1}</div>
            <div class="flex justify-between">
                <div>
                    <h3>${stop.city.name}, ${stop.city.country}</h3>
                    <p class="text-muted">${new Date(stop.startDate).toLocaleDateString()} - ${new Date(stop.endDate).toLocaleDateString()} (${days} days)</p>
                    <div class="flex gap-2 mt-1">
                        <button onclick="openEditStopModal(${stop.id}, '${stop.startDate}', '${stop.endDate}')" class="btn btn-outline" style="padding: 0.1rem 0.5rem; font-size: 0.75rem;">Edit Dates</button>
                        <button onclick="deleteStop(${stop.id})" class="btn btn-outline" style="padding: 0.1rem 0.5rem; font-size: 0.75rem; color: red; border-color: red;">Delete Stop</button>
                    </div>
                </div>
                <div style="text-align: right;">
                    <p style="font-weight: bold;">$${totalStopCost}</p>
                    <p class="text-muted" style="font-size:0.8rem;">Total Cost</p>
                </div>
            </div>
            <div class="mt-4">
                <p style="font-size: 0.9rem;">${stop.city.description || ''}</p>
                
                <div class="mt-4" style="background: #f9fafb; padding: 0.5rem; border-radius: 4px;">
                    <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem;">Activities</h4>
                    ${activitiesHtml}
                    ${addActivitySelect}
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function renderBudgetChart() {
    const ctx = document.getElementById('budgetChart');

    // Calculate costs together
    let labels = [];
    let data = [];
    let total = 0;

    currentTrip.stops.forEach(stop => {
        const days = Math.ceil((new Date(stop.endDate) - new Date(stop.startDate)) / (1000 * 60 * 60 * 24));
        const stayCost = days * stop.city.avgDailyCost;
        const activitiesCost = stop.stopActivities.reduce((acc, sa) => acc + sa.activity.cost, 0);
        const cost = stayCost + activitiesCost;

        labels.push(stop.city.name);
        data.push(cost);
        total += cost;
    });

    document.getElementById('total-cost').textContent = total;

    if (budgetChart) budgetChart.destroy();

    budgetChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#4F46E5', '#10B981', '#EF4444', '#F59E0B', '#3B82F6']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Modal Logic
function openAddStopModal() {
    const modal = document.getElementById('add-stop-modal');
    modal.style.display = 'flex';

    // Update Modal html to utilize search input instead of load all
    const modalContent = document.getElementById('city-selection-container');
    modalContent.innerHTML = `
        <label>Search City (Real-Time)</label>
        <input type="text" id="city-search" class="bg-input" placeholder="Type to search (e.g. London)...">
        <div id="city-search-results" class="trip-grid" style="grid-template-columns: 1fr; gap: 0.5rem; max-height: 200px; overflow-y: auto;"></div>
    `;

    // Move listener setup outside or check if already exists? 
    // Since we recreate the input via innerHTML, we must re-attach.
    const searchInput = document.getElementById('city-search');

    searchInput.addEventListener('input', debounce(async (e) => {
        const query = e.target.value;
        const resultsDiv = document.getElementById('city-search-results');

        if (query.length < 3) {
            resultsDiv.innerHTML = '';
            return;
        }

        resultsDiv.innerHTML = '<small>Searching...</small>';

        try {
            // Call Backend Proxy instead of direct Teleport API
            const res = await API.request(`/proxy/cities?search=${encodeURIComponent(query)}`);
            const data = res;

            // Open-Meteo structure: { results: [...] }
            if (!data.results || data.results.length === 0) {
                resultsDiv.innerHTML = '<small>No cities found.</small>';
                return;
            }

            const cities = data.results;

            resultsDiv.innerHTML = '';
            cities.forEach(c => {
                const name = c.name;
                const country = c.country || 'Unknown';
                const region = c.admin1 || ''; // State/Region often relevant

                const displayName = `${name}, ${region ? region + ', ' : ''}${country}`;

                const div = document.createElement('div');
                div.className = 'card city-select-card';
                div.style.padding = '0.5rem';
                div.innerHTML = `<b>${displayName}</b>`;
                div.onclick = async () => {
                    document.querySelectorAll('.city-select-card').forEach(x => x.classList.remove('selected'));
                    div.classList.add('selected');

                    // Temporarily store selected data
                    window.selectedCityData = { name: name, country: country };
                };
                resultsDiv.appendChild(div);
            });
        } catch (err) {
            console.error(err);
            resultsDiv.innerHTML = `<small style="color:red">Error: ${err.message}</small>`;
        }
    }, 500));
}

function closeAddStopModal() {
    document.getElementById('add-stop-modal').style.display = 'none';
}

// Expose functions to global scope for HTML onclick access
window.addActivity = async function (stopId) {
    const select = document.getElementById(`act-select-${stopId}`);
    const activityId = select.value;

    if (!activityId) {
        alert('Please select an activity first.');
        return;
    }

    try {
        const res = await API.request(`/stops/${stopId}/activities`, 'POST', { activityId });
        if (res.error) {
            alert('Error: ' + res.error);
        } else {
            loadTrip();
        }
    } catch (e) {
        console.error(e);
        alert('Unexpected validation error: ' + e.message);
    }
};

window.deleteStop = async function (stopId) {
    if (!confirm('Are you sure you want to delete this stop?')) return;
    try {
        await API.request(`/stops/${stopId}`, 'DELETE');
        loadTrip();
    } catch (e) {
        console.error(e);
        alert('Failed to delete stop');
    }
};

window.openEditStopModal = function (stopId, currentStart, currentEnd) {
    const startStr = new Date(currentStart).toISOString().split('T')[0];
    const endStr = new Date(currentEnd).toISOString().split('T')[0];

    const newStart = prompt("Enter new start date (YYYY-MM-DD):", startStr);
    if (!newStart) return;
    const newEnd = prompt("Enter new end date (YYYY-MM-DD):", endStr);
    if (!newEnd) return;

    updateStop(stopId, newStart, newEnd);
};

async function updateStop(stopId, startDate, endDate) {
    try {
        await API.request(`/stops/${stopId}`, 'PUT', { startDate, endDate });
        loadTrip();
    } catch (e) {
        console.error(e);
        alert('Failed to update stop dates');
    }
}

window.editActivity = function (saId, name, cost, category) {
    const newName = prompt("Enter activity name:", name);
    if (!newName) return;
    const newCost = prompt("Enter activity cost:", cost);
    if (newCost === null) return;
    const newCategory = prompt("Enter activity category:", category);
    if (!newCategory) return;

    updateActivity(saId, newName, newCost, newCategory);
};

async function updateActivity(saId, name, cost, category) {
    try {
        await API.request(`/stop-activities/${saId}`, 'PUT', { name, cost, category });
        loadTrip();
    } catch (e) {
        console.error(e);
        alert('Failed to update activity');
    }
}

window.removeActivity = async function (stopActivityId) {
    if (!confirm('Remove this activity?')) return;
    try {
        const res = await API.request(`/stop-activities/${stopActivityId}`, 'DELETE');
        if (res.error) {
            alert('Failed to remove: ' + res.error);
        } else {
            loadTrip();
        }
    } catch (e) { console.error(e); }
};

window.addCustomActivity = async function (stopId) {
    const nameInput = document.getElementById(`cust-act-name-${stopId}`);
    const costInput = document.getElementById(`cust-act-cost-${stopId}`);

    const name = nameInput.value.trim();
    const cost = costInput.value;

    if (!name) { alert('Enter activity name'); return; }

    try {
        const res = await API.request(`/stops/${stopId}/custom-activity`, 'POST', { name, cost: cost || 0 });
        if (res.error) {
            alert('Failed to create activity: ' + res.error);
        } else {
            // Success
            loadTrip();
        }
    } catch (e) {
        console.error(e);
        alert('Error creating custom activity: ' + e.message);
    }
};

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

document.getElementById('add-stop-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!window.selectedCityData) { alert('Please search and select a city'); return; }

    const startDate = document.getElementById('stop-start').value;
    const endDate = document.getElementById('stop-end').value;

    try {
        // 1. Ensure City Exists in our DB
        const cityRes = await API.request('/cities/ensure', 'POST', window.selectedCityData);
        if (!cityRes.id) throw new Error('Failed to ensure city');

        // 2. Create Stop
        const orderIndex = currentTrip.stops.length;
        await API.request(`/trips/${tripId}/stops`, 'POST', {
            cityId: cityRes.id,
            startDate,
            endDate,
            orderIndex
        });

        closeAddStopModal();
        loadTrip(); // Reload
        window.selectedCityData = null; // Reset
    } catch (err) {
        console.error(err);
        alert('Failed to add destination');
    }
});
