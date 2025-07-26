document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.style.display = 'none';

  if (!username || !password) {
    errorMsg.textContent = 'Please enter both username and password.';
    errorMsg.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('asylum_token', data.token);
      window.location.href = 'index.html';
    } else {
      errorMsg.textContent = data.error || 'Login failed.';
      errorMsg.style.display = 'block';
    }
  } catch (err) {
    console.error('Login error:', err); // Use err to fix linter error
    errorMsg.textContent = 'Network error. Please try again.';
    errorMsg.style.display = 'block';
  }
}); 