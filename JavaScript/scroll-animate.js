/**
 * Scroll-driven reveal animations using IntersectionObserver.
 * Elements with [data-animate] start hidden and receive .is-visible
 * when they scroll into the viewport.
 */
(function () {
    'use strict';

    if (!('IntersectionObserver' in window)) {
        // Fallback: immediately show everything
        document.querySelectorAll('[data-animate]').forEach(function (el) {
            el.classList.add('is-visible');
        });
        return;
    }

    var observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target); // only animate once
                }
            });
        },
        {
            threshold: 0.15,
            rootMargin: '0px 0px -40px 0px'
        }
    );

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('[data-animate]').forEach(function (el) {
            observer.observe(el);
        });
    });
})();
