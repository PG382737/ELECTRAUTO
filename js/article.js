// ============================================
// ELECTRAUTO - Article Page JavaScript
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

        // Re-render article content in new language
        if (window._currentArticle) renderArticle(window._currentArticle);
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

    // ---- Load Article ----
    var params = new URLSearchParams(window.location.search);
    var slug = params.get('slug');

    var loading = document.getElementById('article-loading');
    var content = document.getElementById('article-content');
    var notFound = document.getElementById('article-not-found');

    if (!slug) {
        showNotFound();
        return;
    }

    loadArticle(slug);

    async function loadArticle(slug) {
        try {
            var article;

            if (typeof supabase !== 'undefined' && supabase.url !== 'YOUR_SUPABASE_URL') {
                article = await supabase.getArticle(slug);
            } else if (typeof window.LOCAL_ARTICLES !== 'undefined') {
                article = window.LOCAL_ARTICLES.find(function(a) {
                    return a.slug === slug && a.published;
                }) || null;
            } else {
                article = null;
            }

            if (!article) {
                showNotFound();
                return;
            }

            window._currentArticle = article;
            renderArticle(article);

            loading.style.display = 'none';
            content.style.display = 'block';

            setupShare(article);

        } catch(e) {
            showNotFound();
        }
    }

    function renderArticle(article) {
        var lang = document.documentElement.lang || 'fr';

        // Bilingual: prefer lang-specific fields, fall back to defaults
        var title = (lang === 'en' && article.title_en) ? article.title_en : (article.title_fr || article.title || '');
        var articleContent = (lang === 'en' && article.content_en) ? article.content_en : (article.content_fr || article.content || '');

        document.title = title + ' | Électr\'auto Québec';

        var dateStr = new Date(article.created_at).toLocaleDateString(
            lang === 'en' ? 'en-CA' : 'fr-CA',
            { year: 'numeric', month: 'long', day: 'numeric' }
        );

        document.getElementById('article-date').textContent = dateStr;
        document.getElementById('article-title').textContent = title;

        var img = document.getElementById('article-image');
        if (article.image_url) {
            img.src = article.image_url;
            img.alt = title;
            img.style.display = 'block';
        }

        document.getElementById('article-body').innerHTML = articleContent;
    }

    function showNotFound() {
        loading.style.display = 'none';
        notFound.style.display = 'block';
    }

    function setupShare(article) {
        var url = window.location.href;

        document.getElementById('share-copy').addEventListener('click', function() {
            navigator.clipboard.writeText(url).then(function() {
                var btn = document.getElementById('share-copy');
                var originalHTML = btn.innerHTML;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(function() { btn.innerHTML = originalHTML; }, 2000);
            });
        });

        document.getElementById('share-facebook').addEventListener('click', function() {
            window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), '_blank', 'width=600,height=400');
        });

        document.getElementById('share-x').addEventListener('click', function() {
            var title = (document.documentElement.lang === 'en' && article.title_en) ? article.title_en : (article.title_fr || article.title || '');
            window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(title), '_blank', 'width=600,height=400');
        });
    }

});
