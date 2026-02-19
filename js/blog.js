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

    // ---- Hamburger ----
    var hamburger = document.getElementById('hamburger');
    var navMenu = document.getElementById('nav-menu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            var isOpen = navMenu.classList.toggle('open');
            hamburger.classList.toggle('active', isOpen);
            hamburger.setAttribute('aria-expanded', isOpen);
        });
        navMenu.querySelectorAll('.nav-link').forEach(function(link) {
            link.addEventListener('click', function() {
                navMenu.classList.remove('open');
                hamburger.classList.remove('active');
            });
        });
    }

    // ---- Navbar scroll ----
    var navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', function() {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
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

                card.innerHTML =
                    (article.image_url
                        ? '<img class="blog-card-image" src="' + article.image_url + '" alt="' + escapeHtml(article.title) + '" loading="lazy">'
                        : '<div class="blog-card-image"></div>') +
                    '<div class="blog-card-body">' +
                        '<div class="blog-card-date">' + dateStr + '</div>' +
                        '<div class="blog-card-title">' + escapeHtml(article.title) + '</div>' +
                        (article.excerpt ? '<div class="blog-card-excerpt">' + escapeHtml(article.excerpt) + '</div>' : '') +
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
