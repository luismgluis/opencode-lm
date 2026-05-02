export const LOGOUT_BAR_JS = `
(function(){
  var x = new XMLHttpRequest();
  x.open('GET', '/auth/session', false);
  x.withCredentials = true;
  x.send();
  if (x.status === 200) {
    var d = JSON.parse(x.responseText);
    if (d && d.user) {
      document.getElementById('ocUserName').textContent = d.user.username;
      document.getElementById('ocAuthBar').style.display = 'flex';
    }
  }
})();
`
