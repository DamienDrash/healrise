/* HEALRISE Landing — progressive Enhancement (ohne JS bleibt alles nutzbar). */
(function () {
  'use strict';

  // Reveal-Animationen nur aktivieren, wenn JS läuft (CSS koppelt an .js)
  document.body.classList.add('js');

  // Sticky-Nav-Schatten
  var nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  // Scroll-Reveal (respektiert prefers-reduced-motion über das CSS)
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  // Newsletter: bewusst ohne Backend — öffnet eine vorbefüllte E-Mail.
  // Ehrlich statt Fake-Bestätigung; Eintragung erfolgt manuell durch das Team.
  var form = document.getElementById('nl-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (form.elements.name.value || '').trim();
      var email = (form.elements.email.value || '').trim();
      var subject = encodeURIComponent('Newsletter-Anmeldung');
      var body = encodeURIComponent(
        'Hallo HEALRISE-Team,\n\nbitte nehmt mich in den Newsletter auf.\n\nName: ' +
        (name || '—') + '\nE-Mail: ' + email + '\n\nDanke!'
      );
      window.location.href = 'mailto:hello@healrise.de?subject=' + subject + '&body=' + body;
    });
  }
})();
