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

// ---- Session helpers ----
function getSession() {
    try { return JSON.parse(localStorage.getItem('ea-session') || '{}'); } catch(e) { return {}; }
}
function setSession(data) {
    try { localStorage.setItem('ea-session', JSON.stringify(data)); } catch(e) {}
}
function clearSession() {
    try { localStorage.removeItem('ea-session'); } catch(e) {}
}
function getTrustToken() {
    try { return localStorage.getItem('ea-trust') || ''; } catch(e) { return ''; }
}
function setTrustToken(token, expires) {
    try { localStorage.setItem('ea-trust', token); localStorage.setItem('ea-trust-exp', expires); } catch(e) {}
}
function clearTrustToken() {
    try { localStorage.removeItem('ea-trust'); localStorage.removeItem('ea-trust-exp'); } catch(e) {}
}

function enterDashboard(password) {
    adminPassword = password;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    loadArticles();
    loadDelays();
}

// ---- Check session / lockout on page load ----
(function() {
    var lockData = getLockout();
    if (lockData.locked_until) {
        var remaining = Math.ceil((new Date(lockData.locked_until) - new Date()) / 1000);
        if (remaining > 0) {
            showLockoutScreen(remaining);
            return;
        }
        setLockout({});
    }

    // Check existing session
    var session = getSession();
    if (session.password && session.expires && new Date(session.expires) > new Date()) {
        enterDashboard(session.password);
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
        var loginBody = { action: 'login', password_hash: hash };
        var trustToken = getTrustToken();
        if (trustToken) loginBody.trust_token = trustToken;

        var res = await fetch('/api/admin-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginBody)
        });

        var data = await res.json();

        if (res.status === 429) {
            var lockedUntil = new Date(Date.now() + (data.remaining_seconds || 3600) * 1000).toISOString();
            setLockout({ locked_until: lockedUntil });
            showLockoutScreen(data.remaining_seconds || 3600);
            return;
        }

        if (res.status === 401) {
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

        // Trusted device — skip 2FA
        if (data.skip_2fa) {
            setSession({ password: password, expires: data.session_expires });
            setLockout({});
            enterDashboard(password);
            return;
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
        var remember = document.getElementById('tfa-remember-check').checked;

        var res = await fetch('/api/admin-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', code: code, password_hash: hash, remember: remember })
        });

        var data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.message || 'Code invalide.';
            codeInput.value = '';
            codeInput.focus();
            return;
        }

        // 2FA success — save session, trust token, enter dashboard
        setLockout({});
        setSession({ password: adminPassword, expires: data.session_expires });
        if (data.trust_token) {
            setTrustToken(data.trust_token, data.trust_expires);
        }
        enterDashboard(adminPassword);

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

        // Start/stop notes polling based on active tab
        if (link.dataset.tab === 'notes') {
            loadNotes();
            startNotesPolling();
        } else {
            stopNotesPolling();
        }
    });
});

// ============================================
// LOGOUT
// ============================================
document.getElementById('btn-logout').addEventListener('click', function() {
    adminPassword = '';
    setLockout({});
    clearSession();
    stopNotesPolling();
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('tfa-form').style.display = 'none';
    document.getElementById('login-pwd').value = '';
    document.getElementById('login-error').textContent = '';
    document.getElementById('login-attempts').textContent = '';
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

    // Reset file input, update remove button, switch to FR tab
    document.getElementById('image-file').value = '';
    updateRemoveImageBtn();
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

// ---- Image Upload with Crop ----
var cropperInstance = null;
var cropFilename = '';

document.getElementById('image-file').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;

    cropFilename = file.name;

    // Read file and open crop modal
    var reader = new FileReader();
    reader.onload = function(ev) {
        openCropModal(ev.target.result);
    };
    reader.readAsDataURL(file);

    // Reset file input so same file can be re-selected
    e.target.value = '';
});

function openCropModal(imageSrc) {
    var modal = document.getElementById('crop-modal');
    var img = document.getElementById('crop-image');

    img.src = imageSrc;
    modal.classList.add('active');

    // Reset ratio buttons
    document.querySelectorAll('.crop-ratio').forEach(function(b) { b.classList.remove('active'); });
    document.querySelector('.crop-ratio[data-ratio="1.777"]').classList.add('active');

    // Destroy previous instance if any
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }

    // Initialize Cropper after image loads
    img.onload = function() {
        cropperInstance = new Cropper(img, {
            aspectRatio: 16 / 9,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.9,
            responsive: true,
            background: false
        });
    };
}

function closeCropModal() {
    var modal = document.getElementById('crop-modal');
    modal.classList.remove('active');
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
}

// Aspect ratio buttons
document.querySelectorAll('.crop-ratio').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.crop-ratio').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var ratio = parseFloat(btn.dataset.ratio);
        if (cropperInstance) {
            cropperInstance.setAspectRatio(ratio === 0 ? NaN : ratio);
        }
    });
});

// Confirm crop
document.getElementById('crop-confirm').addEventListener('click', async function() {
    if (!cropperInstance) return;

    var confirmBtn = document.getElementById('crop-confirm');
    confirmBtn.disabled = true;
    confirmBtn.classList.add('btn-loading');

    try {
        var canvas = cropperInstance.getCroppedCanvas({
            maxWidth: 1600,
            maxHeight: 1200,
            imageSmoothingQuality: 'high'
        });

        // Show preview in article modal
        var preview = document.getElementById('image-preview');
        var uploadArea = document.getElementById('image-upload');
        preview.innerHTML = '<img src="' + canvas.toDataURL() + '" alt="Preview">';
        uploadArea.classList.add('has-image');

        // Convert canvas to base64 and upload
        var base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];

        var res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + adminPassword
            },
            body: JSON.stringify({
                data: base64,
                filename: cropFilename.replace(/\.[^.]+$/, '.jpg'),
                contentType: 'image/jpeg'
            })
        });

        if (!res.ok) throw new Error('Upload failed');
        var result = await res.json();
        document.getElementById('edit-image-url').value = result.url;
        updateRemoveImageBtn();

        closeCropModal();
    } catch(err) {
        alert('Erreur upload: ' + err.message);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('btn-loading');
    }
});

// Cancel crop
document.getElementById('crop-cancel').addEventListener('click', closeCropModal);
document.getElementById('crop-close').addEventListener('click', closeCropModal);

// ---- Remove Image ----
document.getElementById('btn-remove-image').addEventListener('click', function() {
    document.getElementById('edit-image-url').value = '';
    document.getElementById('image-file').value = '';
    document.getElementById('image-preview').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;opacity:.4;margin-bottom:6px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span>Cliquer pour ajouter</span>';
    document.getElementById('image-upload').classList.remove('has-image');
    document.getElementById('btn-remove-image').style.display = 'none';
});

function updateRemoveImageBtn() {
    var hasImage = document.getElementById('edit-image-url').value || document.getElementById('image-upload').classList.contains('has-image');
    document.getElementById('btn-remove-image').style.display = hasImage ? 'flex' : 'none';
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

// ============================================
// NOTES
// ============================================

var notesPollingInterval = null;
var notesLastTimestamp = null;

async function loadNotes() {
    try {
        var data = await api('GET', '/api/notes');
        renderNotes(data);
        if (data.length > 0) {
            notesLastTimestamp = data[0].created_at;
        }
    } catch(e) {
        // Notes table may not exist yet
    }
}

function renderNotes(notes) {
    var feed = document.getElementById('notes-feed');
    if (!notes || notes.length === 0) {
        feed.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:48px;height:48px;opacity:.3;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>Aucune note. Écrivez votre première note ci-dessous.</p></div>';
        return;
    }
    feed.innerHTML = notes.map(function(note) {
        return '<div class="note-item" data-id="' + note.id + '">' +
            '<button class="note-item__delete" onclick="deleteNote(\'' + note.id + '\')" title="Supprimer">&times;</button>' +
            '<div class="note-item__date">' + formatNoteDate(note.created_at) + '</div>' +
            '<div class="note-item__text">' + escapeHtml(note.text) + '</div>' +
            '</div>';
    }).join('');
}

function formatNoteDate(iso) {
    var d = new Date(iso);
    var now = new Date();
    var opts = { hour: '2-digit', minute: '2-digit' };
    var time = d.toLocaleTimeString('fr-CA', opts);

    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var noteDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diff = Math.floor((today - noteDay) / 86400000);

    if (diff === 0) return "Aujourd'hui à " + time;
    if (diff === 1) return 'Hier à ' + time;
    return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) + ' à ' + time;
}

// Send note
document.getElementById('btn-send-note').addEventListener('click', sendNote);
document.getElementById('note-text').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendNote();
    }
});

async function sendNote() {
    var input = document.getElementById('note-text');
    var text = input.value.trim();
    if (!text) return;

    var btn = document.getElementById('btn-send-note');
    btn.disabled = true;

    try {
        await api('POST', '/api/notes', { text: text });
        input.value = '';
        // Reload all notes to stay in sync
        await loadNotes();
    } catch(e) {
        alert('Erreur: ' + e.message);
    } finally {
        btn.disabled = false;
        input.focus();
    }
}

// Delete note
window.deleteNote = async function(id) {
    try {
        await api('DELETE', '/api/notes?id=' + id);
        await loadNotes();
    } catch(e) {
        alert('Erreur: ' + e.message);
    }
};

// Polling — check for new notes every 3 seconds
function startNotesPolling() {
    if (notesPollingInterval) return;
    notesPollingInterval = setInterval(async function() {
        if (!notesLastTimestamp) return;
        try {
            var newNotes = await api('GET', '/api/notes?since=' + encodeURIComponent(notesLastTimestamp));
            if (newNotes && newNotes.length > 0) {
                // New notes found — reload all
                await loadNotes();
            }
        } catch(e) {
            // Silently ignore polling errors
        }
    }, 3000);
}

function stopNotesPolling() {
    if (notesPollingInterval) {
        clearInterval(notesPollingInterval);
        notesPollingInterval = null;
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
