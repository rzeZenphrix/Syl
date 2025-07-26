function isLoggedIn() {
  return !!localStorage.getItem('asylum_token');
}

function logout() {
  localStorage.removeItem('asylum_token');
  window.location.href = 'login.html';
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
  }
} 