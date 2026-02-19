// ============================================
// ELECTRAUTO - Admin Panel JavaScript
// ============================================

var adminPassword = '';
var PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

// ---- SHA-256 ----
async function sha256(str) {
    var buf = new TextEncoder().encode(str);
    var hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map(function(b) {
        return b.toString(16).padStart(2, '0');
    }).join('');
}

// ---- Login ----
window.adminLogin = async function(e) {
    e.preventDefault();
    var input = document.getElementById('admin-pwd');
    var hash = await sha256(input.value);

    if (hash === PASSWORD_HASH) {
        adminPassword = input.value;
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';
        // Also set preview access
        try { sessionStorage.setItem('electrauto-preview', 'true'); } catch(ex) {}
        loadArticles();
    } else {
        input.classList.add('error');
        input.value = '';
        setTimeout(function() { input.classList.remove('error'); }, 500);
    }
};

// ---- API Helper ----
async function api(method, params, body) {
    var url = '/api/articles';
    if (params) {
        url += '?' + new URLSearchParams(params).toString();
    }

    var options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + adminPassword
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    var res = await fetch(url, options);
    if (!res.ok) {
        var err = await res.json().catch(function() { return { error: 'Unknown error' }; });
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
}

// ---- Load Articles ----
async function loadArticles() {
    var container = document.getElementById('articles-container');

    try {
        var articles = await api('GET', { all: 'true' });

        if (!articles || articles.length === 0) {
            container.innerHTML =
                '<div class="admin-empty">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V9a2 2 0 012-2h2a2 2 0 012 2v9a2 2 0 01-2 2h-2z"/></svg>' +
                    '<h3>Aucun article</h3>' +
                    '<p>Créez votre premier article en cliquant sur "Nouvel article".</p>' +
                '</div>';
            return;
        }

        var html = '<table class="articles-table"><thead><tr>' +
            '<th>Titre</th><th>Date</th><th>Statut</th><th>Actions</th>' +
            '</tr></thead><tbody>';

        articles.forEach(function(a) {
            var date = new Date(a.created_at).toLocaleDateString('fr-CA', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            var statusClass = a.published ? 'article-status--published' : 'article-status--draft';
            var statusText = a.published ? 'Publié' : 'Brouillon';

            html += '<tr>' +
                '<td><strong>' + escapeHtml(a.title) + '</strong></td>' +
                '<td>' + date + '</td>' +
                '<td><span class="article-status ' + statusClass + '">' + statusText + '</span></td>' +
                '<td><div class="table-actions">' +
                    '<button class="admin-btn admin-btn--outline" onclick="editArticle(\'' + a.id + '\')">Modifier</button>' +
                    '<button class="admin-btn admin-btn--danger" onclick="confirmDelete(\'' + a.id + '\')">Supprimer</button>' +
                '</div></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // Store articles for editing
        window._articles = articles;

    } catch(e) {
        container.innerHTML =
            '<div class="admin-empty">' +
                '<h3>Erreur de chargement</h3>' +
                '<p>' + escapeHtml(e.message) + '</p>' +
            '</div>';
    }
}

// ---- Article Modal ----
window.openArticleModal = function(article) {
    document.getElementById('article-modal').classList.add('active');
    document.getElementById('modal-title').textContent = article ? 'Modifier l\'article' : 'Nouvel article';
    document.getElementById('edit-id').value = article ? article.id : '';
    document.getElementById('edit-title').value = article ? article.title : '';
    document.getElementById('edit-excerpt').value = article ? (article.excerpt || '') : '';
    document.getElementById('edit-content').innerHTML = article ? article.content : '';
    document.getElementById('edit-status').value = article ? (article.published ? 'published' : 'draft') : 'draft';
    document.getElementById('edit-image-url').value = article ? (article.image_url || '') : '';

    // Image preview
    var preview = document.getElementById('image-preview');
    if (article && article.image_url) {
        preview.innerHTML = '<img src="' + article.image_url + '" alt="Preview">';
        document.getElementById('image-upload').classList.add('has-image');
    } else {
        preview.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--gray-400);margin-bottom:8px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' +
            '<p>Cliquer pour ajouter une image</p>';
        document.getElementById('image-upload').classList.remove('has-image');
    }

    // Reset file input
    document.getElementById('image-file').value = '';
};

window.closeArticleModal = function() {
    document.getElementById('article-modal').classList.remove('active');
};

// ---- Image Upload ----
document.getElementById('image-file').addEventListener('change', async function(e) {
    var file = e.target.files[0];
    if (!file) return;

    var preview = document.getElementById('image-preview');
    var uploadArea = document.getElementById('image-upload');

    // Show preview immediately
    var reader = new FileReader();
    reader.onload = function(e) {
        preview.innerHTML = '<img src="' + e.target.result + '" alt="Preview">';
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
        alert('Erreur lors de l\'upload: ' + err.message);
    }
});

function fileToBase64(file) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() {
            // Remove data:...;base64, prefix
            var base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ---- Rich Text Commands ----
window.execCmd = function(cmd, value) {
    if (cmd === 'formatBlock') {
        document.execCommand('formatBlock', false, '<' + value + '>');
    } else {
        document.execCommand(cmd, false, value || null);
    }
    document.getElementById('edit-content').focus();
};

window.insertLink = function() {
    var url = prompt('URL du lien:');
    if (url) {
        document.execCommand('createLink', false, url);
    }
};

// ---- Save Article ----
window.saveArticle = async function() {
    var title = document.getElementById('edit-title').value.trim();
    var content = document.getElementById('edit-content').innerHTML.trim();
    var excerpt = document.getElementById('edit-excerpt').value.trim();
    var imageUrl = document.getElementById('edit-image-url').value;
    var published = document.getElementById('edit-status').value === 'published';
    var id = document.getElementById('edit-id').value;

    if (!title) {
        alert('Le titre est requis.');
        return;
    }

    if (!content) {
        alert('Le contenu est requis.');
        return;
    }

    var btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.textContent = 'Sauvegarde...';

    try {
        var data = {
            title: title,
            content: content,
            excerpt: excerpt,
            image_url: imageUrl || null,
            published: published
        };

        if (id) {
            data.id = id;
            await api('PUT', null, data);
        } else {
            await api('POST', null, data);
        }

        closeArticleModal();
        loadArticles();

    } catch(e) {
        alert('Erreur: ' + e.message);
    }

    btn.disabled = false;
    btn.textContent = 'Sauvegarder';
};

// ---- Edit Article ----
window.editArticle = function(id) {
    var articles = window._articles || [];
    var article = articles.find(function(a) { return a.id === id; });
    if (article) {
        openArticleModal(article);
    }
};

// ---- Delete Article ----
var deleteTargetId = null;

window.confirmDelete = function(id) {
    deleteTargetId = id;
    document.getElementById('confirm-dialog').classList.add('active');
};

window.closeConfirm = function() {
    deleteTargetId = null;
    document.getElementById('confirm-dialog').classList.remove('active');
};

document.getElementById('confirm-delete-btn').addEventListener('click', async function() {
    if (!deleteTargetId) return;

    try {
        await api('DELETE', { id: deleteTargetId });
        closeConfirm();
        loadArticles();
    } catch(e) {
        alert('Erreur: ' + e.message);
        closeConfirm();
    }
});

// ---- Close modals on overlay click ----
document.getElementById('article-modal').addEventListener('click', function(e) {
    if (e.target === this) closeArticleModal();
});

document.getElementById('confirm-dialog').addEventListener('click', function(e) {
    if (e.target === this) closeConfirm();
});

// ---- Close modals on Escape ----
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
