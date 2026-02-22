// ============================================
// ELECTRAUTO - Main JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    // ---- Language Switcher ----
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
        var saved = localStorage.getItem('electrauto-lang');
        if (saved === 'en') setLang('en');
    } catch(e) {}

    // ---- Navbar Scroll Effect ----
    var navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', function() {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }, { passive: true });
    }

    // ---- Hamburger Menu ----
    var hamburger = document.getElementById('hamburger');
    var navMenu = document.getElementById('nav-menu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            var isOpen = navMenu.classList.toggle('open');
            hamburger.classList.toggle('active', isOpen);
            hamburger.setAttribute('aria-expanded', isOpen);
        });

        // Close menu on nav link click
        navMenu.querySelectorAll('.nav-link').forEach(function(link) {
            link.addEventListener('click', function() {
                navMenu.classList.remove('open');
                hamburger.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // ---- Active Nav Link on Scroll ----
    var sections = document.querySelectorAll('section[id]');
    var navLinks = document.querySelectorAll('.nav-link[href^="#"]');

    function updateActiveNav() {
        var scrollY = window.scrollY + 100;

        sections.forEach(function(section) {
            var top = section.offsetTop;
            var height = section.offsetHeight;
            var id = section.getAttribute('id');

            if (scrollY >= top && scrollY < top + height) {
                navLinks.forEach(function(link) {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + id) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    window.addEventListener('scroll', updateActiveNav, { passive: true });
    updateActiveNav();

    // ---- Reveal on Scroll (Intersection Observer) ----
    var reveals = document.querySelectorAll('.reveal');
    if (reveals.length > 0 && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -40px 0px'
        });

        reveals.forEach(function(el) {
            observer.observe(el);
        });
    }

    // ---- Contact Form ----
    var contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var status = document.getElementById('form-status');
            var btn = contactForm.querySelector('button[type="submit"]');
            var originalText = btn.textContent;

            btn.disabled = true;
            btn.textContent = '...';
            status.textContent = '';
            status.className = 'form-status';

            var data = {
                name: contactForm.querySelector('[name="name"]').value,
                email: contactForm.querySelector('[name="email"]').value,
                phone: contactForm.querySelector('[name="phone"]').value,
                message: contactForm.querySelector('[name="message"]').value
            };

            try {
                var res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (res.ok) {
                    var lang = document.documentElement.lang || 'fr';
                    status.textContent = lang === 'en'
                        ? 'Message sent successfully!'
                        : 'Message envoyé avec succès!';
                    status.className = 'form-status success';
                    contactForm.reset();
                } else {
                    throw new Error('Failed');
                }
            } catch(err) {
                var lang = document.documentElement.lang || 'fr';
                status.textContent = lang === 'en'
                    ? 'Error sending message. Please try again.'
                    : 'Erreur lors de l\'envoi. Veuillez réessayer.';
                status.className = 'form-status error';
            }

            btn.disabled = false;
            btn.textContent = originalText;
        });
    }

    // ---- Blog Preview (load 3 latest articles) ----
    var blogPreview = document.getElementById('blog-preview');
    var blogEmpty = document.getElementById('blog-empty');

    if (blogPreview && typeof supabase !== 'undefined' && supabase.url !== 'YOUR_SUPABASE_URL') {
        loadBlogPreview();
    }

    async function loadBlogPreview() {
        try {
            var articles = await supabase.getArticles(3, 0);
            if (articles && articles.length > 0) {
                if (blogEmpty) blogEmpty.style.display = 'none';
                var lang = document.documentElement.lang || 'fr';

                articles.forEach(function(article) {
                    var card = document.createElement('a');
                    card.href = 'article.html?slug=' + encodeURIComponent(article.slug);
                    card.className = 'blog-card reveal visible';

                    var dateStr = new Date(article.created_at).toLocaleDateString(
                        lang === 'en' ? 'en-CA' : 'fr-CA',
                        { year: 'numeric', month: 'long', day: 'numeric' }
                    );

                    card.innerHTML =
                        (article.image_url
                            ? '<img class="blog-card-image" src="' + article.image_url + '" alt="' + article.title + '">'
                            : '<div class="blog-card-image"></div>') +
                        '<div class="blog-card-body">' +
                            '<div class="blog-card-date">' + dateStr + '</div>' +
                            '<div class="blog-card-title">' + article.title + '</div>' +
                            (article.excerpt ? '<div class="blog-card-excerpt">' + article.excerpt + '</div>' : '') +
                        '</div>';

                    blogPreview.insertBefore(card, blogEmpty);
                });
            }
        } catch(e) {
            // Silently fail - show empty state
        }
    }

});
