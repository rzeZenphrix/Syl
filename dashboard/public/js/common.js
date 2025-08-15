// Common JS for dashboard
export function getToken() {
	return localStorage.getItem('asylum_token');
}

export function authHeaders() {
	const t = getToken();
	return t ? { Authorization: 'Bearer ' + t } : {};
}

export function requireAuth() {
	const t = getToken();
	if (!t) window.location.href = 'login.html';
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }