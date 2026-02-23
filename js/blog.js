// ============================================
// ELECTRAUTO - Blog Page JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {

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

    try {
        var saved = localStorage.getItem('electrauto-lang');
        if (saved === 'en') setLang('en');
    } catch(e) {}

    // ---- Theme Toggle ----
    var themeToggle = document.getElementById('theme-toggle');
    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        try { localStorage.setItem('electrauto-theme', t); } catch(e) {}
    }
    try {
        var savedTheme = localStorage.getItem('electrauto-theme');
        if (savedTheme) applyTheme(savedTheme);
    } catch(e) {}
    function toggleTheme() {
        var current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'light' ? 'dark' : 'light');
    }
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    var themeToggleMenu = document.getElementById('theme-toggle-menu');
    if (themeToggleMenu) themeToggleMenu.addEventListener('click', toggleTheme);

    // ---- Burger Menu ----
    var burger = document.getElementById('burger');
    var navLinks = document.getElementById('nav-links');
    if (burger && navLinks) {
        burger.addEventListener('click', function() {
            var isOpen = navLinks.classList.toggle('open');
            burger.classList.toggle('active', isOpen);
            burger.setAttribute('aria-expanded', isOpen);
        });
        navLinks.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                navLinks.classList.remove('open');
                burger.classList.remove('active');
            });
        });
    }

    // ---- Navbar scroll ----
    var nav = document.getElementById('nav');
    if (nav) {
        window.addEventListener('scroll', function() {
            nav.classList.toggle('scrolled', window.scrollY > 50);
        }, { passive: true });
    }

    // ---- Load Articles ----
    var blogList = document.getElementById('blog-list');
    var blogEmpty = document.getElementById('blog-empty');
    var loadMoreWrapper = document.getElementById('load-more-wrapper');
    var loadMoreBtn = document.getElementById('load-more');
    var LIMIT = 9;
    var offset = 0;

    var useSupabase = typeof supabase !== 'undefined' && supabase.url !== 'YOUR_SUPABASE_URL';
    var useLocal = !useSupabase && typeof window.LOCAL_ARTICLES !== 'undefined';

    if (useSupabase || useLocal) {
        loadArticles();
    } else {
        blogEmpty.style.display = 'block';
    }

    async function loadArticles() {
        try {
            var articles;

            if (useSupabase) {
                articles = await supabase.getArticles(LIMIT, offset);
            } else {
                // Local fallback
                articles = window.LOCAL_ARTICLES.filter(function(a) { return a.published; });
                articles = articles.slice(offset, offset + LIMIT);
            }

            if (articles.length === 0 && offset === 0) {
                blogEmpty.style.display = 'block';
                return;
            }

            var lang = document.documentElement.lang || 'fr';

            articles.forEach(function(article) {
                var card = document.createElement('a');
                card.href = 'article.html?slug=' + encodeURIComponent(article.slug);
                card.className = 'blog-card';

                var dateStr = new Date(article.created_at).toLocaleDateString(
                    lang === 'en' ? 'en-CA' : 'fr-CA',
                    { year: 'numeric', month: 'long', day: 'numeric' }
                );

                // Bilingual support: prefer lang-specific fields, fall back to default
                var title = (lang === 'en' && article.title_en) ? article.title_en : (article.title_fr || article.title || '');
                var excerpt = (lang === 'en' && article.excerpt_en) ? article.excerpt_en : (article.excerpt_fr || article.excerpt || '');

                card.innerHTML =
                    (article.image_url
                        ? '<img class="blog-card-image" src="' + article.image_url + '" alt="' + escapeHtml(title) + '" loading="lazy">'
                        : '<div class="blog-card-image"></div>') +
                    '<div class="blog-card-body">' +
                        '<div class="blog-card-date">' + dateStr + '</div>' +
                        '<div class="blog-card-title">' + escapeHtml(title) + '</div>' +
                        (excerpt ? '<div class="blog-card-excerpt">' + escapeHtml(excerpt) + '</div>' : '') +
                    '</div>';

                blogList.appendChild(card);
            });

            offset += articles.length;

            var totalLocal = useLocal ? window.LOCAL_ARTICLES.filter(function(a) { return a.published; }).length : 0;
            if (useSupabase && articles.length >= LIMIT) {
                loadMoreWrapper.style.display = 'block';
            } else if (useLocal && offset < totalLocal) {
                loadMoreWrapper.style.display = 'block';
            } else {
                loadMoreWrapper.style.display = 'none';
            }

        } catch(e) {
            blogEmpty.style.display = 'block';
        }
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadArticles);
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

});
