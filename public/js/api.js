const API = {
    baseUrl: '/api',

    getToken() {
        return localStorage.getItem('token');
    },

    async request(endpoint, method = 'GET', data = null) {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const config = {
            method,
            headers,
        };

        if (data) config.body = JSON.stringify(data);

        const response = await fetch(`${this.baseUrl}${endpoint}`, config);
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
            return;
        }

        const contentType = response.headers.get('content-type');
        let resData;

        if (contentType && contentType.includes('application/json')) {
            resData = await response.json();
        } else {
            const text = await response.text();
            throw new Error(`Server returned non-JSON response (${response.status}): ${text.slice(0, 100)}...`);
        }

        if (!response.ok) {
            throw new Error(resData.error || `API Request Failed with status ${response.status}`);
        }
        return resData;
    }
};
