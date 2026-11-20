// Server page: the Copy buttons next to each command.
(function () {
  document.querySelectorAll('.sv-copy').forEach(function (btn) {
    var label = btn.querySelector('span');
    var timer = 0;
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy') || '';
      var done = function (ok) {
        btn.classList.toggle('is-done', ok);
        label.textContent = ok ? 'Copied' : 'Select and copy';
        clearTimeout(timer);
        timer = setTimeout(function () { btn.classList.remove('is-done'); label.textContent = 'Copy'; }, 1800);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  });
})();
