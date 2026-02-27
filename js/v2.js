// ============================================
// ELECTRAUTO V2 — Main JavaScript
// ============================================

(function() {

    // ---- Language ----
    window.setLang = function(lang) {
        document.getElementById('btn-fr').classList.toggle('active', lang === 'fr');
        document.getElementById('btn-en').classList.toggle('active', lang === 'en');
        document.documentElement.lang = lang;

        document.querySelectorAll('[data-fr][data-en]').forEach(function(el) {
            var val = el.getAttribute('data-' + lang);
            if (el.innerHTML.includes('<br') || el.innerHTML.includes('<a')) {
                el.innerHTML = val;
            } else {
                el.textContent = val;
            }
        });

        try { localStorage.setItem('electrauto-lang', lang); } catch(e) {}
    };

    // Language init
    try {
        if (localStorage.getItem('electrauto-lang') === 'en') setLang('en');
    } catch(e) {}

    // ---- Theme Toggle (dark/light) ----
    var themeBtn = document.getElementById('theme-toggle');
    var themeBtnMenu = document.getElementById('theme-toggle-menu');

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem('electrauto-theme', theme); } catch(e) {}
    }

    function toggleTheme() {
        var current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'light' ? 'dark' : 'light');
    }

    // Init theme from saved preference
    try {
        var savedTheme = localStorage.getItem('electrauto-theme');
        if (savedTheme) setTheme(savedTheme);
    } catch(e) {}

    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    if (themeBtnMenu) themeBtnMenu.addEventListener('click', toggleTheme);

    // ---- Navbar scroll ----
    var nav = document.getElementById('nav');
    window.addEventListener('scroll', function() {
        nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });

    // ---- Hamburger ----
    var burger = document.getElementById('burger');
    var links = document.getElementById('nav-links');

    burger.addEventListener('click', function() {
        var open = links.classList.toggle('open');
        burger.classList.toggle('active', open);
    });

    links.querySelectorAll('a').forEach(function(a) {
        a.addEventListener('click', function() {
            links.classList.remove('open');
            burger.classList.remove('active');
        });
    });

    // ---- Smooth scroll for anchor links + clean URL ----
    document.querySelectorAll('a[href^="#"], a[href^="index.html#"]').forEach(function(a) {
        a.addEventListener('click', function(e) {
            var href = this.getAttribute('href');
            var hash = href.indexOf('#') !== -1 ? href.substring(href.indexOf('#')) : '';
            if (!hash) return;
            var target = document.querySelector(hash);
            if (!target) return;
            e.preventDefault();
            var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
            var top = target.getBoundingClientRect().top + window.scrollY - navH;
            window.scrollTo({ top: top, behavior: 'smooth' });
            history.replaceState(null, '', window.location.pathname);
        });
    });

    // Handle hash on page load (from other pages), then clean URL
    var _pendingHash = window.location.hash || null;

    function scrollToHash() {
        if (!_pendingHash) return;
        var el = document.querySelector(_pendingHash);
        if (!el) return;
        var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
        var top = el.getBoundingClientRect().top + window.scrollY - navH;
        window.scrollTo({ top: top, behavior: 'smooth' });
        history.replaceState(null, '', window.location.pathname);
        _pendingHash = null;
    }

    if (_pendingHash) {
        history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);
    }

    // ---- Active link on scroll ----
    var sections = document.querySelectorAll('section[id]');
    var navAnchors = document.querySelectorAll('.nav__links a[href^="#"]');
    var navShortcuts = document.querySelectorAll('.nav__shortcut[href^="#"]');

    window.addEventListener('scroll', function() {
        var y = window.scrollY + 120;
        sections.forEach(function(sec) {
            if (y >= sec.offsetTop && y < sec.offsetTop + sec.offsetHeight) {
                var id = sec.getAttribute('id');
                navAnchors.forEach(function(a) {
                    a.classList.toggle('active', a.getAttribute('href') === '#' + id);
                });
                navShortcuts.forEach(function(a) {
                    a.classList.toggle('active', a.getAttribute('href') === '#' + id);
                });
            }
        });
    }, { passive: true });

    // ---- Reveal on scroll ----
    var reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function(entries) {
            entries.forEach(function(e) {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

        reveals.forEach(function(el) { obs.observe(el); });
    }

    // ---- Service card expand/collapse ----
    var servicesGrid = document.getElementById('services-grid');
    var servicesSection = servicesGrid ? servicesGrid.closest('section') : null;

    window.toggleService = function(card) {
        var wasExpanded = card.classList.contains('expanded');

        // Anchor: save the section heading position relative to viewport
        var anchor = servicesSection || servicesGrid;
        var anchorTop = anchor.getBoundingClientRect().top;

        // Close all cards first
        document.querySelectorAll('.scard.expanded').forEach(function(c) {
            c.classList.remove('expanded');
        });

        if (!wasExpanded) {
            card.classList.add('expanded');
            servicesGrid.classList.add('has-expanded');

            // Scroll the expanded card into view smoothly
            var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
            var cardTop = card.getBoundingClientRect().top + window.scrollY - navH - 20;
            window.scrollTo({ top: cardTop, behavior: 'smooth' });
        } else {
            servicesGrid.classList.remove('has-expanded');

            // Restore scroll so the section stays at same viewport position
            var newAnchorTop = anchor.getBoundingClientRect().top;
            var drift = newAnchorTop - anchorTop;
            if (Math.abs(drift) > 1) {
                window.scrollBy(0, drift);
            }
        }
    };

    // ---- Auto-resize textarea ----
    var textarea = document.querySelector('textarea[name="message"]');
    if (textarea) {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    }

    // ---- Phone formatting (xxx) xxx-xxxx ----
    var phoneInput = document.querySelector('input[name="phone"]');
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            var digits = this.value.replace(/\D/g, '').substring(0, 10);
            if (digits.length >= 7) {
                this.value = '(' + digits.substring(0,3) + ') ' + digits.substring(3,6) + '-' + digits.substring(6);
            } else if (digits.length >= 4) {
                this.value = '(' + digits.substring(0,3) + ') ' + digits.substring(3);
            } else if (digits.length > 0) {
                this.value = '(' + digits;
            }
        });
    }

    // ---- Contact form ----
    var form = document.getElementById('contact-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var status = document.getElementById('form-status');
            var btn = form.querySelector('button[type="submit"]');
            var orig = btn.textContent;

            btn.disabled = true;
            btn.textContent = '';
            btn.classList.add('btn-loading');
            status.textContent = '';
            status.className = 'form-status';

            try {
                var res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: form.querySelector('[name="name"]').value,
                        email: form.querySelector('[name="email"]').value,
                        phone: form.querySelector('[name="phone"]').value,
                        message: form.querySelector('[name="message"]').value
                    })
                });

                if (res.ok) {
                    var lang = document.documentElement.lang || 'fr';
                    var formBox = form.closest('.contact__form');
                    formBox.innerHTML = '<div class="form-success">'
                        + '<div class="form-success__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 10"/></svg></div>'
                        + '<h3>' + (lang === 'en' ? 'Message sent!' : 'Message envoyé!') + '</h3>'
                        + '<p>' + (lang === 'en'
                            ? 'Thank you for contacting us. A representative will get back to you shortly.'
                            : 'Merci de nous avoir contacté. Un représentant communiquera avec vous dans les plus brefs délais.') + '</p>'
                        + '</div>';
                } else {
                    throw new Error();
                }
            } catch(err) {
                var lang = document.documentElement.lang || 'fr';
                status.textContent = lang === 'en' ? 'Error. Please try again.' : 'Erreur. Veuillez réessayer.';
                status.className = 'form-status error';
            }

            btn.disabled = false;
            btn.classList.remove('btn-loading');
            btn.textContent = orig;
        });
    }

    // ---- Blog preview ----
    var blogPreview = document.getElementById('blog-preview');
    var blogEmpty = document.getElementById('blog-empty');

    function renderBlogPreview(articles) {
        if (articles && articles.length > 0) {
            if (blogEmpty) blogEmpty.style.display = 'none';
            var lang = document.documentElement.lang || 'fr';

            articles.forEach(function(a) {
                var card = document.createElement('a');
                card.href = 'article.html?slug=' + encodeURIComponent(a.slug);
                card.className = 'blog-card reveal visible';

                var date = new Date(a.created_at).toLocaleDateString(
                    lang === 'en' ? 'en-CA' : 'fr-CA',
                    { year: 'numeric', month: 'long', day: 'numeric' }
                );

                var logoHtml = a.logo_overlay ? '<span class="blog-card-logo">ELECTR<span class="o">&#8217;</span>AUTO</span>' : '';
                card.innerHTML =
                    (a.image_url ? '<div class="blog-card-img' + (a.logo_overlay ? ' blog-card-img--logo' : '') + '"><img class="blog-card-image" src="' + a.image_url + '" alt="">' + logoHtml + '</div>' : '<div class="blog-card-placeholder">ELECTR<span>\u2019</span>AUTO</div>') +
                    '<div class="blog-card-body">' +
                        '<div class="blog-card-date">' + date + '</div>' +
                        '<div class="blog-card-title">' + a.title + '</div>' +
                        (a.excerpt ? '<div class="blog-card-excerpt">' + a.excerpt + '</div>' : '') +
                    '</div>';

                blogPreview.insertBefore(card, blogEmpty);
            });
        }
    }

    if (blogPreview) {
        fetch('/api/articles?limit=4&offset=0')
            .then(function(res) { return res.json(); })
            .then(function(articles) {
                renderBlogPreview(articles);
                scrollToHash();
            })
            .catch(function() { scrollToHash(); });
    } else {
        // No blog section — scroll on load
        if (document.readyState === 'complete') { scrollToHash(); }
        else { window.addEventListener('load', scrollToHash); }
    }

})();
