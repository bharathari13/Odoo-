// Validation Helpers
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showFeedback(type, message) {
    const feedbackEl = document.getElementById('form-feedback');
    if (feedbackEl) {
        feedbackEl.className = `form-feedback feedback-${type}`;
        feedbackEl.textContent = message;
        feedbackEl.style.display = 'block';
    }
}

function clearFeedback() {
    const feedbackEl = document.getElementById('form-feedback');
    if (feedbackEl) {
        feedbackEl.style.display = 'none';
    }
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    document.querySelectorAll('.error-text').forEach(el => el.style.display = 'none');
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFeedback();

            const emailInput = document.getElementById('email');
            const passInput = document.getElementById('password');
            const btn = loginForm.querySelector('button[type="submit"]');

            const email = emailInput.value.trim();
            const password = passInput.value;

            if (!validateEmail(email)) {
                emailInput.classList.add('input-error');
                const errText = document.getElementById('email-error');
                if (errText) errText.style.display = 'block';
                return;
            }

            if (!password) {
                passInput.classList.add('input-error');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Logging in...';

            try {
                const res = await API.request('/login', 'POST', { email, password });
                if (res.token) {
                    showFeedback('success', 'Login successful! Redirecting...');
                    localStorage.setItem('token', res.token);
                    localStorage.setItem('user', JSON.stringify(res.user));
                    setTimeout(() => window.location.href = '/dashboard.html', 1000);
                } else {
                    showFeedback('error', res.error || 'Login failed. Please check your credentials.');
                    btn.disabled = false;
                    btn.textContent = 'Login';
                }
            } catch (err) {
                console.error(err);
                showFeedback('error', err.message || 'An unexpected error occurred.');
                btn.disabled = false;
                btn.textContent = 'Login';
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFeedback();

            const nameInput = document.getElementById('name');
            const emailInput = document.getElementById('email');
            const passInput = document.getElementById('password');
            const btn = signupForm.querySelector('button[type="submit"]');

            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passInput.value;

            let isValid = true;

            if (name.length < 2) {
                nameInput.classList.add('input-error');
                isValid = false;
            }
            if (!validateEmail(email)) {
                emailInput.classList.add('input-error');
                const errText = document.getElementById('email-error');
                if (errText) errText.style.display = 'block';
                isValid = false;
            }
            if (password.length < 6) {
                passInput.classList.add('input-error');
                const errText = document.getElementById('password-error');
                if (errText) errText.style.display = 'block';
                isValid = false;
            }

            if (!isValid) return;

            btn.disabled = true;
            btn.textContent = 'Signing up...';

            try {
                const res = await API.request('/signup', 'POST', { name, email, password });
                if (res.token) {
                    showFeedback('success', 'Account created! Redirecting...');
                    localStorage.setItem('token', res.token);
                    localStorage.setItem('user', JSON.stringify(res.user));
                    setTimeout(() => window.location.href = '/dashboard.html', 1000);
                } else {
                    showFeedback('error', res.error || 'Signup failed.');
                    btn.disabled = false;
                    btn.textContent = 'Sign Up';
                }
            } catch (err) {
                console.error(err);
                showFeedback('error', err.message || 'Unable to create account right now.');
                btn.disabled = false;
                btn.textContent = 'Sign Up';
            }
        });
    }
});
