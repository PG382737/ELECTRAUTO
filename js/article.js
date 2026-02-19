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
                // Local fallback
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

            // Set page title
            document.title = article.title + ' | Électr\'auto Québec';

            // Populate article
            var lang = document.documentElement.lang || 'fr';
            var dateStr = new Date(article.created_at).toLocaleDateString(
                lang === 'en' ? 'en-CA' : 'fr-CA',
                { year: 'numeric', month: 'long', day: 'numeric' }
            );

            document.getElementById('article-date').textContent = dateStr;
            document.getElementById('article-title').textContent = article.title;

            var img = document.getElementById('article-image');
            if (article.image_url) {
                img.src = article.image_url;
                img.alt = article.title;
                img.style.display = 'block';
            }

            document.getElementById('article-body').innerHTML = article.content;

            loading.style.display = 'none';
            content.style.display = 'block';

            // Setup share buttons
            setupShare(article);

        } catch(e) {
            showNotFound();
        }
    }

    function showNotFound() {
        loading.style.display = 'none';
        notFound.style.display = 'block';
    }

    function setupShare(article) {
        var url = window.location.href;

        // Copy link
        document.getElementById('share-copy').addEventListener('click', function() {
            navigator.clipboard.writeText(url).then(function() {
                var btn = document.getElementById('share-copy');
                var originalHTML = btn.innerHTML;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(function() { btn.innerHTML = originalHTML; }, 2000);
            });
        });

        // Facebook
        document.getElementById('share-facebook').addEventListener('click', function() {
            window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), '_blank', 'width=600,height=400');
        });

        // X (Twitter)
        document.getElementById('share-x').addEventListener('click', function() {
            window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(article.title), '_blank', 'width=600,height=400');
        });
    }

});
