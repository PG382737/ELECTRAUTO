// ============================================
// ELECTRAUTO — Admin Panel JavaScript
// ============================================

var adminPassword = '';
var PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';
var MAX_ATTEMPTS = 5;
var lockoutInterval = null;

// ---- SHA-256 ----
async function sha256(str) {
    var buf = new TextEncoder().encode(str);
    var hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map(function(b) {
        return b.toString(16).padStart(2, '0');
    }).join('');
}

// ---- Lockout helpers ----
function getLockout() {
    try {
        var data = JSON.parse(localStorage.getItem('ea-lockout') || '{}');
        return data;
    } catch(e) { return {}; }
}

function setLockout(data) {
    try { localStorage.setItem('ea-lockout', JSON.stringify(data)); } catch(e) {}
}

function showLockoutScreen(remainingSeconds) {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('tfa-form').style.display = 'none';
    document.getElementById('lockout-screen').style.display = 'block';

    updateLockoutTimer(remainingSeconds);

    if (lockoutInterval) clearInterval(lockoutInterval);
    lockoutInterval = setInterval(function() {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
            clearInterval(lockoutInterval);
            lockoutInterval = null;
            setLockout({});
            document.getElementById('lockout-screen').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
            document.getElementById('login-attempts').textContent = '';
            document.getElementById('login-error').textContent = '';
        } else {
            updateLockoutTimer(remainingSeconds);
        }
    }, 1000);
}

function updateLockoutTimer(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    document.getElementById('lockout-timer').textContent =
        String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function updateAttemptsDisplay(attemptsLeft) {
    var el = document.getElementById('login-attempts');
    if (attemptsLeft <= 0) {
        el.textContent = '';
        return;
    }
    el.textContent = attemptsLeft + ' essai' + (attemptsLeft > 1 ? 's' : '') + ' restant' + (attemptsLeft > 1 ? 's' : '') + ' avant blocage';
    el.className = 'login__attempts' + (attemptsLeft <= 2 ? ' danger' : attemptsLeft <= 3 ? ' warning' : '');
}

// ---- Check lockout on page load ----
(function() {
    var lockData = getLockout();
    if (lockData.locked_until) {
        var remaining = Math.ceil((new Date(lockData.locked_until) - new Date()) / 1000);
        if (remaining > 0) {
            showLockoutScreen(remaining);
        } else {
            setLockout({});
        }
    }
})();

// ---- Step 1: Password Login ----
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Client-side lockout check
    var lockData = getLockout();
    if (lockData.locked_until) {
        var remaining = Math.ceil((new Date(lockData.locked_until) - new Date()) / 1000);
        if (remaining > 0) {
            showLockoutScreen(remaining);
            return;
        }
        setLockout({});
    }

    var input = document.getElementById('login-pwd');
    var btn = document.getElementById('login-btn');
    var errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    var password = input.value;
    var hash = await sha256(password);

    btn.disabled = true;
    btn.classList.add('btn-loading');

    try {
        var res = await fetch('/api/admin-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', password_hash: hash })
        });

        var data = await res.json();

        if (res.status === 429) {
            // Locked out
            var lockedUntil = new Date(Date.now() + (data.remaining_seconds || 3600) * 1000).toISOString();
            setLockout({ locked_until: lockedUntil });
            showLockoutScreen(data.remaining_seconds || 3600);
            return;
        }

        if (res.status === 401) {
            // Wrong password
            input.classList.add('error');
            input.value = '';
            setTimeout(function() { input.classList.remove('error'); }, 500);
            if (typeof data.attempts_left === 'number') {
                updateAttemptsDisplay(data.attempts_left);
                setLockout({ attempts: MAX_ATTEMPTS - data.attempts_left });
            }
            return;
        }

        if (!res.ok) {
            throw new Error(data.error || 'Erreur serveur');
        }

        // Password correct — show 2FA step
        adminPassword = password;
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('tfa-form').style.display = 'block';
        document.getElementById('tfa-code').value = '';
        document.getElementById('tfa-code').focus();

    } catch(err) {
        errorEl.textContent = err.message || 'Erreur de connexion.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Accéder';
        btn.classList.remove('btn-loading');
    }
});

// ---- Step 2: 2FA Code Verification ----
document.getElementById('tfa-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    var codeInput = document.getElementById('tfa-code');
    var btn = document.getElementById('tfa-btn');
    var errorEl = document.getElementById('tfa-error');
    errorEl.textContent = '';

    var code = codeInput.value.trim();
    if (code.length !== 6) {
        errorEl.textContent = 'Entrez le code à 6 chiffres.';
        return;
    }

    var hash = await sha256(adminPassword);

    btn.disabled = true;
    btn.classList.add('btn-loading');

    try {
        var res = await fetch('/api/admin-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', code: code, password_hash: hash })
        });

        var data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.message || 'Code invalide.';
            codeInput.value = '';
            codeInput.focus();
            return;
        }

        // 2FA success — enter dashboard
        setLockout({});
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'flex';
        try { sessionStorage.setItem('electrauto-preview', 'true'); } catch(ex) {}
        loadArticles();
        loadDelays();

    } catch(err) {
        errorEl.textContent = err.message || 'Erreur de vérification.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Vérifier';
        btn.classList.remove('btn-loading');
    }
});

// ---- 2FA: digits only ----
document.getElementById('tfa-code').addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, '');
});

// ---- Back button from 2FA ----
document.getElementById('tfa-back').addEventListener('click', function() {
    document.getElementById('tfa-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('login-pwd').value = '';
    document.getElementById('login-pwd').focus();
    adminPassword = '';
});

// ---- API Helper ----
async function api(method, url, body) {
    var options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + adminPassword
        }
    };
    if (body) options.body = JSON.stringify(body);

    var res = await fetch(url, options);
    if (!res.ok) {
        var err = await res.json().catch(function() { return { error: 'Unknown error' }; });
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
}

// ============================================
// SIDEBAR TABS
// ============================================
document.querySelectorAll('.sidebar__link[data-tab]').forEach(function(link) {
    link.addEventListener('click', function() {
        document.querySelectorAll('.sidebar__link[data-tab]').forEach(function(l) { l.classList.remove('active'); });
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        link.classList.add('active');
        document.getElementById('tab-' + link.dataset.tab).classList.add('active');
    });
});

// ============================================
// BLOG — ARTICLES
// ============================================

async function loadArticles() {
    var container = document.getElementById('articles-container');

    try {
        var articles = await api('GET', '/api/articles?all=true');

        if (!articles || articles.length === 0) {
            container.innerHTML =
                '<div class="empty-state">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
                    '<p>Aucun article. Cliquez sur «&nbsp;Nouvel article&nbsp;» pour commencer.</p>' +
                '</div>';
            return;
        }

        var html = '<table class="articles-table"><thead><tr>' +
            '<th>Titre</th><th>Date</th><th>Statut</th><th style="text-align:right;">Actions</th>' +
            '</tr></thead><tbody>';

        articles.forEach(function(a) {
            var date = new Date(a.created_at).toLocaleDateString('fr-CA', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            var isPub = a.published;
            var badgeClass = isPub ? 'badge-status--published' : 'badge-status--draft';
            var badgeText = isPub ? 'Publié' : 'Brouillon';

            html += '<tr>' +
                '<td class="col-title">' + escapeHtml(a.title || a.title_fr || '') + '</td>' +
                '<td class="col-date">' + date + '</td>' +
                '<td><span class="badge-status ' + badgeClass + '">' + badgeText + '</span></td>' +
                '<td><div class="col-actions">' +
                    '<button class="btn btn--ghost btn--sm" onclick="editArticle(\'' + a.id + '\')">Modifier</button>' +
                    '<button class="btn btn--danger btn--sm" onclick="confirmDelete(\'' + a.id + '\')">Supprimer</button>' +
                '</div></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
        window._articles = articles;

    } catch(e) {
        container.innerHTML =
            '<div class="empty-state">' +
                '<p>Erreur: ' + escapeHtml(e.message) + '</p>' +
            '</div>';
    }
}

// ---- Article Modal ----
var articleModal = document.getElementById('article-modal');

document.getElementById('btn-new-article').addEventListener('click', function() {
    openArticleModal(null);
});

function openArticleModal(article) {
    articleModal.classList.add('active');
    document.getElementById('modal-title').textContent = article ? 'Modifier l\'article' : 'Nouvel article';
    document.getElementById('edit-id').value = article ? article.id : '';

    // FR fields
    document.getElementById('edit-title-fr').value = article ? (article.title_fr || article.title || '') : '';
    document.getElementById('edit-excerpt-fr').value = article ? (article.excerpt_fr || article.excerpt || '') : '';
    document.getElementById('edit-content-fr').innerHTML = article ? (article.content_fr || article.content || '') : '';

    // EN fields
    document.getElementById('edit-title-en').value = article ? (article.title_en || '') : '';
    document.getElementById('edit-excerpt-en').value = article ? (article.excerpt_en || '') : '';
    document.getElementById('edit-content-en').innerHTML = article ? (article.content_en || '') : '';

    // Shared fields
    document.getElementById('edit-status').value = article ? (article.published ? 'published' : 'draft') : 'draft';
    document.getElementById('edit-image-url').value = article ? (article.image_url || '') : '';

    // Image preview
    var preview = document.getElementById('image-preview');
    var upload = document.getElementById('image-upload');
    if (article && article.image_url) {
        preview.innerHTML = '<img src="' + article.image_url + '" alt="Preview">';
        upload.classList.add('has-image');
    } else {
        preview.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;opacity:.4;margin-bottom:6px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' +
            '<span>Cliquer pour ajouter</span>';
        upload.classList.remove('has-image');
    }

    // Reset file input and switch to FR tab
    document.getElementById('image-file').value = '';
    switchLangTab('fr');
}

function closeArticleModal() {
    articleModal.classList.remove('active');
}

document.getElementById('modal-close').addEventListener('click', closeArticleModal);
document.getElementById('btn-cancel').addEventListener('click', closeArticleModal);
articleModal.addEventListener('click', function(e) {
    if (e.target === articleModal) closeArticleModal();
});

// ---- Language Tabs ----
document.querySelectorAll('.lang-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
        switchLangTab(tab.dataset.lang);
    });
});

function switchLangTab(lang) {
    document.querySelectorAll('.lang-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.lang === lang);
    });
    document.querySelectorAll('.lang-panel').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('panel-' + lang).classList.add('active');
}

// ---- Rich Text Toolbar ----
document.querySelectorAll('.tb-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var cmd = btn.dataset.cmd;
        var val = btn.dataset.val || null;

        if (cmd === 'createLink') {
            var url = prompt('URL du lien:');
            if (url) document.execCommand('createLink', false, url);
        } else if (cmd === 'formatBlock') {
            document.execCommand('formatBlock', false, '<' + val + '>');
        } else {
            document.execCommand(cmd, false, val);
        }
    });
});

// ---- Image Upload ----
document.getElementById('image-file').addEventListener('change', async function(e) {
    var file = e.target.files[0];
    if (!file) return;

    var preview = document.getElementById('image-preview');
    var uploadArea = document.getElementById('image-upload');

    // Show preview immediately
    var reader = new FileReader();
    reader.onload = function(ev) {
        preview.innerHTML = '<img src="' + ev.target.result + '" alt="Preview">';
        uploadArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
        var base64 = await fileToBase64(file);
        var res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + adminPassword
            },
            body: JSON.stringify({
                data: base64,
                filename: file.name,
                contentType: file.type
            })
        });

        if (!res.ok) throw new Error('Upload failed');
        var result = await res.json();
        document.getElementById('edit-image-url').value = result.url;
    } catch(err) {
        alert('Erreur upload: ' + err.message);
    }
});

function fileToBase64(file) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(reader.result.split(',')[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ---- Save Article ----
document.getElementById('btn-save').addEventListener('click', async function() {
    var titleFr = document.getElementById('edit-title-fr').value.trim();
    var contentFr = document.getElementById('edit-content-fr').innerHTML.trim();

    if (!titleFr) { alert('Le titre français est requis.'); return; }
    if (!contentFr) { alert('Le contenu français est requis.'); return; }

    var btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.textContent = 'Sauvegarde...';

    try {
        var data = {
            title_fr: titleFr,
            excerpt_fr: document.getElementById('edit-excerpt-fr').value.trim(),
            content_fr: contentFr,
            title_en: document.getElementById('edit-title-en').value.trim(),
            excerpt_en: document.getElementById('edit-excerpt-en').value.trim(),
            content_en: document.getElementById('edit-content-en').innerHTML.trim(),
            image_url: document.getElementById('edit-image-url').value || null,
            published: document.getElementById('edit-status').value === 'published'
        };

        var id = document.getElementById('edit-id').value;
        if (id) {
            data.id = id;
            await api('PUT', '/api/articles', data);
        } else {
            await api('POST', '/api/articles', data);
        }

        closeArticleModal();
        loadArticles();
    } catch(e) {
        alert('Erreur: ' + e.message);
    }

    btn.disabled = false;
    btn.textContent = 'Sauvegarder';
});

// ---- Edit Article ----
window.editArticle = function(id) {
    var articles = window._articles || [];
    var article = articles.find(function(a) { return a.id == id; });
    if (article) openArticleModal(article);
};

// ---- Delete Article ----
var deleteTargetId = null;
var confirmModal = document.getElementById('confirm-modal');

window.confirmDelete = function(id) {
    deleteTargetId = id;
    confirmModal.classList.add('active');
};

function closeConfirm() {
    deleteTargetId = null;
    confirmModal.classList.remove('active');
}

document.getElementById('confirm-close').addEventListener('click', closeConfirm);
document.getElementById('btn-cancel-delete').addEventListener('click', closeConfirm);
confirmModal.addEventListener('click', function(e) {
    if (e.target === confirmModal) closeConfirm();
});

document.getElementById('btn-confirm-delete').addEventListener('click', async function() {
    if (!deleteTargetId) return;
    try {
        await api('DELETE', '/api/articles?id=' + deleteTargetId);
        closeConfirm();
        loadArticles();
    } catch(e) {
        alert('Erreur: ' + e.message);
        closeConfirm();
    }
});

// ============================================
// DELAYS
// ============================================

async function loadDelays() {
    try {
        var data = await api('GET', '/api/delays');
        if (data.service) selectDelay('delay-service', data.service);
        if (data.repair) selectDelay('delay-repair', data.repair);
    } catch(e) {
        // No delays saved yet — that's fine
    }
}

function selectDelay(containerId, value) {
    var container = document.getElementById(containerId);
    container.querySelectorAll('.delay-opt').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
}

// Click handlers for delay buttons
document.querySelectorAll('.delay-options').forEach(function(container) {
    container.addEventListener('click', function(e) {
        var btn = e.target.closest('.delay-opt');
        if (!btn) return;

        container.querySelectorAll('.delay-opt').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');

        saveDelays();
    });
});

async function saveDelays() {
    var serviceBtn = document.querySelector('#delay-service .delay-opt.active');
    var repairBtn = document.querySelector('#delay-repair .delay-opt.active');
    var statusEl = document.getElementById('delays-status');

    var data = {
        service: serviceBtn ? serviceBtn.dataset.value : null,
        repair: repairBtn ? repairBtn.dataset.value : null
    };

    try {
        await api('POST', '/api/delays', data);
        statusEl.className = 'delays-status success';
        statusEl.textContent = 'Délais sauvegardés avec succès.';
        setTimeout(function() { statusEl.className = 'delays-status'; }, 3000);
    } catch(e) {
        statusEl.className = 'delays-status error';
        statusEl.textContent = 'Erreur: ' + e.message;
    }
}

// ---- Escape key ----
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeArticleModal();
        closeConfirm();
    }
});

// ---- Utils ----
function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
