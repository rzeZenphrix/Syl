// auth.js - shim for legacy HTML pages
(function(){
  function getToken(){ return localStorage.getItem('asylum_token'); }
  window.requireAuth = function() {
    const t = getToken();
    if (!t) window.location.href = 'login.html';
  };
  window.logout = function() {
    localStorage.removeItem('asylum_token');
    window.location.href = 'login.html';
  };
})(); 