// ================================================
// Todo Module - Task Management System
// ================================================

(function() {
    'use strict';

    var allTodos = [];
    var completedTodos = [];
    var todoEmployees = {};
    var todoVehicles = {};
    var completedVisible = false;
    var todoPollingInterval = null;
    var currentDetailId = null;
    var allVehicleOptions = [];

    var PRIORITIES = { 1: { label: 'Urgente', color: '#e54545', icon: '!!!' }, 2: { label: 'Normale', color: '#cf8a2e', icon: '!!' }, 3: { label: 'Basse', color: '#22c55e', icon: '!' } };
    var CATEGORIES = ['Mécanique', 'Commande pièces', 'Administratif', 'Nettoyage', 'Autre'];

    // ---- Helpers ----

    function escHtml(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function empName(id) {
        var e = todoEmployees[id];
        return e ? e.first_name + ' ' + e.last_name : '';
    }

    function vehLabel(id) {
        var v = todoVehicles[id];
        if (!v) return '';
        return v.make + (v.model ? ' ' + v.model : '') + (v.plate ? ' - ' + v.plate : '');
    }

    function formatDate(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatDateTime(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
    }

    function isOverdue(todo) {
        if (!todo.due_date || todo.completed_at) return false;
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var due = new Date(todo.due_date + 'T00:00:00');
        return due < today;
    }

    function isDueSoon(todo) {
        if (!todo.due_date || todo.completed_at) return false;
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var due = new Date(todo.due_date + 'T00:00:00');
        var diff = (due - today) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 2;
    }

    // ---- Toast (reuse from global) ----
    function showToast(type, title, msg) {
        if (window.Control && window.Control._showToast) {
            window.Control._showToast(type, title, msg);
            return;
        }
        var container = document.getElementById('toast-container');
        if (!container) return;
        var toast = document.createElement('div');
        toast.className = 'toast toast--' + type;
        toast.innerHTML = '<div class="toast__body"><div class="toast__title">' + escHtml(title) + '</div>' +
            (msg ? '<div class="toast__msg">' + escHtml(msg) + '</div>' : '') + '</div>' +
            '<button class="toast__close">&times;</button>';
        container.appendChild(toast);
        toast.querySelector('.toast__close').addEventListener('click', function() { toast.remove(); });
        setTimeout(function() { toast.classList.add('toast--removing'); setTimeout(function() { toast.remove(); }, 300); }, 5000);
    }

    // ---- Vehicle Search Select ----

    function renderVehicleDropdown(query) {
        var dropdown = document.getElementById('todo-vehicle-dropdown');
        if (!dropdown) return;
        var q = (query || '').toLowerCase().trim();
        var filtered = q ? allVehicleOptions.filter(function(v) { return v.label.toLowerCase().indexOf(q) !== -1; }) : allVehicleOptions;
        var html = '';
        if (filtered.length === 0) {
            html = '<div class="search-select__option search-select__option--empty">Aucun véhicule trouvé</div>';
        } else {
            filtered.slice(0, 50).forEach(function(v) {
                html += '<div class="search-select__option" data-id="' + v.id + '">' + escHtml(v.label) + '</div>';
            });
        }
        dropdown.innerHTML = html;
    }

    function selectVehicle(id, label) {
        document.getElementById('todo-vehicle').value = id;
        document.getElementById('todo-vehicle-search').value = label;
        document.getElementById('todo-vehicle-dropdown').classList.remove('active');
        var clearBtn = document.getElementById('todo-vehicle-clear');
        clearBtn.style.display = id ? '' : 'none';
    }

    function clearVehicle() {
        document.getElementById('todo-vehicle').value = '';
        document.getElementById('todo-vehicle-search').value = '';
        document.getElementById('todo-vehicle-clear').style.display = 'none';
        renderVehicleDropdown('');
    }

    function initVehicleSearch() {
        var input = document.getElementById('todo-vehicle-search');
        var dropdown = document.getElementById('todo-vehicle-dropdown');
        var clearBtn = document.getElementById('todo-vehicle-clear');

        input.addEventListener('input', function() {
            renderVehicleDropdown(this.value);
            dropdown.classList.add('active');
        });

        input.addEventListener('focus', function() {
            renderVehicleDropdown(this.value);
            dropdown.classList.add('active');
        });

        dropdown.addEventListener('click', function(e) {
            var opt = e.target.closest('.search-select__option');
            if (!opt || opt.classList.contains('search-select__option--empty')) return;
            selectVehicle(opt.dataset.id, opt.textContent);
        });

        clearBtn.addEventListener('click', function() { clearVehicle(); });

        // Close on click outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#todo-vehicle-wrap')) {
                dropdown.classList.remove('active');
            }
        });
    }

    // ---- Populate dropdowns ----

    async function loadDropdownData() {
        try {
            var emps = await api('GET', '/api/control-employees');
            var vehs = await api('GET', '/api/control-vehicles');

            // Employee selects
            var empOptions = '<option value="">— Aucun —</option>';
            emps.sort(function(a, b) { return (a.first_name + ' ' + a.last_name).localeCompare(b.first_name + ' ' + b.last_name); });
            emps.forEach(function(e) {
                empOptions += '<option value="' + e.id + '">' + escHtml(e.first_name + ' ' + e.last_name) + '</option>';
            });

            document.getElementById('todo-created-by').innerHTML = empOptions;
            document.getElementById('todo-assigned-to').innerHTML = empOptions;
            document.getElementById('todo-complete-by').innerHTML = empOptions.replace('— Aucun —', '— Sélectionner —');

            // Filter assignee
            var filterOptions = '<option value="">Tous les employés</option>';
            emps.forEach(function(e) {
                filterOptions += '<option value="' + e.id + '">' + escHtml(e.first_name + ' ' + e.last_name) + '</option>';
            });
            document.getElementById('todo-filter-assignee').innerHTML = filterOptions;

            // Vehicle search select
            vehs.sort(function(a, b) {
                var la = (a.make || '') + ' ' + (a.model || '');
                var lb = (b.make || '') + ' ' + (b.model || '');
                return la.localeCompare(lb);
            });
            allVehicleOptions = vehs.map(function(v) {
                var label = v.make + (v.model ? ' ' + v.model : '') + (v.year ? ' ' + v.year : '') + (v.plate ? ' - ' + v.plate : '') + (v.owner_name ? ' (' + v.owner_name + ')' : '');
                return { id: v.id, label: label };
            });
            renderVehicleDropdown('');
        } catch(e) { console.error('loadDropdownData:', e); }
    }

    // ---- Load Todos ----

    async function loadTodos() {
        try {
            var data = await api('GET', '/api/control-todos');
            allTodos = data.todos || [];
            todoEmployees = data.employees || {};
            todoVehicles = data.vehicles || {};
            renderActiveTodos();
            updateBadge();

            // Load completed in background
            var compData = await api('GET', '/api/control-todos?completed=true');
            completedTodos = compData.todos || [];
            // Merge employee/vehicle maps
            Object.assign(todoEmployees, compData.employees || {});
            Object.assign(todoVehicles, compData.vehicles || {});
            renderCompletedTodos();
        } catch(e) {
            document.getElementById('todo-active-list').innerHTML = '<div class="todo-empty">Erreur: ' + escHtml(e.message) + '</div>';
        }
    }

    function getFilteredTodos(todos) {
        var priority = document.getElementById('todo-filter-priority').value;
        var category = document.getElementById('todo-filter-category').value;
        var assignee = document.getElementById('todo-filter-assignee').value;
        var sort = document.getElementById('todo-sort').value;

        var filtered = todos.filter(function(t) {
            if (priority && t.priority !== parseInt(priority)) return false;
            if (category && t.category !== category) return false;
            if (assignee && t.assigned_to !== assignee) return false;
            return true;
        });

        filtered.sort(function(a, b) {
            if (sort === 'priority') {
                if (a.priority !== b.priority) return a.priority - b.priority;
                // Overdue first within same priority
                var aOver = isOverdue(a) ? 0 : 1;
                var bOver = isOverdue(b) ? 0 : 1;
                if (aOver !== bOver) return aOver - bOver;
                return new Date(b.created_at) - new Date(a.created_at);
            } else if (sort === 'due_date') {
                var aDate = a.due_date || '9999-12-31';
                var bDate = b.due_date || '9999-12-31';
                return aDate.localeCompare(bDate);
            } else {
                return new Date(b.created_at) - new Date(a.created_at);
            }
        });

        return filtered;
    }

    function renderActiveTodos() {
        var el = document.getElementById('todo-active-list');
        var filtered = getFilteredTodos(allTodos);
        document.getElementById('todo-active-count').textContent = allTodos.length;

        if (filtered.length === 0) {
            el.innerHTML = '<div class="todo-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:48px;height:48px;color:var(--text-muted);margin-bottom:12px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><p>' + (allTodos.length === 0 ? 'Aucune tâche. Créez votre première tâche.' : 'Aucune tâche ne correspond aux filtres.') + '</p></div>';
            return;
        }

        var html = '';
        filtered.forEach(function(t) { html += renderTodoCard(t); });
        el.innerHTML = html;
    }

    function renderCompletedTodos() {
        var el = document.getElementById('todo-completed-list');
        document.getElementById('todo-completed-count').textContent = completedTodos.length;

        if (completedTodos.length === 0) {
            el.innerHTML = '<div class="todo-empty" style="padding:20px;"><p>Aucune tâche complétée.</p></div>';
            return;
        }

        var html = '';
        completedTodos.forEach(function(t) { html += renderTodoCard(t, true); });
        el.innerHTML = html;
    }

    function renderTodoCard(t, isCompleted) {
        var p = PRIORITIES[t.priority] || PRIORITIES[2];
        var overdue = isOverdue(t);
        var dueSoon = isDueSoon(t);
        var overdueClass = overdue ? ' todo-card--overdue' : (dueSoon ? ' todo-card--due-soon' : '');
        var completedClass = isCompleted ? ' todo-card--completed' : '';

        var html = '<div class="todo-card' + overdueClass + completedClass + '" onclick="Todos.openDetail(\'' + t.id + '\')">';

        // Priority flag
        html += '<div class="todo-card__flag" style="background:' + p.color + ';" title="' + p.label + '">' + p.icon + '</div>';

        // Content
        html += '<div class="todo-card__content">';
        html += '<div class="todo-card__title">' + escHtml(t.title) + '</div>';

        // Description preview
        if (t.description) {
            var preview = t.description.length > 120 ? t.description.substring(0, 120) + '…' : t.description;
            html += '<div class="todo-card__desc">' + escHtml(preview) + '</div>';
        }

        // Meta line
        var meta = [];
        if (t.category) meta.push('<span class="todo-meta-tag">' + escHtml(t.category) + '</span>');
        if (t.assigned_to && empName(t.assigned_to)) meta.push('<span class="todo-meta-assignee">' + escHtml(empName(t.assigned_to)) + '</span>');
        if (t.vehicle_id && vehLabel(t.vehicle_id)) meta.push('<span class="todo-meta-vehicle">' + escHtml(vehLabel(t.vehicle_id)) + '</span>');
        if (t.due_date) {
            var dueCls = overdue ? ' todo-meta-date--overdue' : (dueSoon ? ' todo-meta-date--soon' : '');
            meta.push('<span class="todo-meta-date' + dueCls + '">' + formatDate(t.due_date) + '</span>');
        }
        if (isCompleted && t.completed_by) {
            meta.push('<span class="todo-meta-completed">Complétée par ' + escHtml(empName(t.completed_by)) + '</span>');
        }
        if (meta.length > 0) html += '<div class="todo-card__meta">' + meta.join('') + '</div>';

        html += '</div>';

        // Action buttons
        if (!isCompleted) {
            html += '<button class="todo-card__complete" onclick="event.stopPropagation();Todos.promptComplete(\'' + t.id + '\')" title="Compléter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></button>';
        }

        html += '</div>';
        return html;
    }

    // ---- Badge ----

    function updateBadge() {
        var badge = document.getElementById('todo-sidebar-badge');
        if (!badge) return;
        var count = allTodos.length;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    }

    // Poll badge count (for when other users add todos)
    function startTodoPolling() {
        if (todoPollingInterval) return;
        todoPollingInterval = setInterval(function() {
            var tab = document.getElementById('tab-todos');
            if (tab && tab.classList.contains('active')) {
                loadTodos();
            } else {
                // Just update badge
                api('GET', '/api/control-todos?count=true').then(function(data) {
                    var badge = document.getElementById('todo-sidebar-badge');
                    if (!badge) return;
                    if (data.count > 0) {
                        badge.textContent = data.count;
                        badge.style.display = '';
                    } else {
                        badge.style.display = 'none';
                    }
                }).catch(function() {});
            }
        }, 10000);
    }

    // ---- Create / Edit ----

    function openTodoModal(todo) {
        document.getElementById('todo-edit-id').value = todo ? todo.id : '';
        document.getElementById('todo-modal-title').textContent = todo ? 'Modifier la tâche' : 'Nouvelle tâche';
        document.getElementById('todo-title').value = todo ? todo.title : '';
        document.getElementById('todo-description').value = todo ? (todo.description || '') : '';
        document.getElementById('todo-priority').value = todo ? todo.priority : 2;
        document.getElementById('todo-category').value = todo ? (todo.category || 'Autre') : 'Autre';
        document.getElementById('todo-created-by').value = todo ? (todo.created_by || '') : '';
        document.getElementById('todo-assigned-to').value = todo ? (todo.assigned_to || '') : '';
        document.getElementById('todo-due-date').value = todo ? (todo.due_date || '') : '';

        // Vehicle search select
        if (todo && todo.vehicle_id) {
            var vOpt = allVehicleOptions.find(function(v) { return v.id === todo.vehicle_id; });
            selectVehicle(todo.vehicle_id, vOpt ? vOpt.label : '');
        } else {
            clearVehicle();
        }

        // Disable created_by when editing
        document.getElementById('todo-created-by').disabled = !!todo;

        document.getElementById('todo-modal').classList.add('active');
        if (!todo) document.getElementById('todo-title').focus();
    }

    async function saveTodo() {
        var id = document.getElementById('todo-edit-id').value;
        var title = document.getElementById('todo-title').value.trim();
        if (!title) {
            showToast('error', 'Erreur', 'Le titre est obligatoire.');
            return;
        }

        var body = {
            title: title,
            description: document.getElementById('todo-description').value.trim(),
            priority: parseInt(document.getElementById('todo-priority').value),
            category: document.getElementById('todo-category').value,
            assigned_to: document.getElementById('todo-assigned-to').value || null,
            vehicle_id: document.getElementById('todo-vehicle').value || null,
            due_date: document.getElementById('todo-due-date').value || null
        };

        try {
            if (id) {
                body.id = id;
                await api('PATCH', '/api/control-todos', body);
                showToast('success', 'Modifiée', 'Tâche mise à jour.');
            } else {
                body.created_by = document.getElementById('todo-created-by').value || null;
                await api('POST', '/api/control-todos', body);
                showToast('success', 'Créée', 'Nouvelle tâche ajoutée.');
            }
            document.getElementById('todo-modal').classList.remove('active');
            loadTodos();
        } catch(e) {
            showToast('error', 'Erreur', e.message);
        }
    }

    // ---- Complete ----

    var pendingCompleteId = null;

    function promptComplete(id) {
        pendingCompleteId = id;
        document.getElementById('todo-complete-by').value = '';
        document.getElementById('todo-complete-modal').classList.add('active');
    }

    async function confirmComplete() {
        var completedBy = document.getElementById('todo-complete-by').value;
        if (!completedBy) {
            showToast('error', 'Erreur', 'Sélectionnez qui a complété la tâche.');
            return;
        }

        try {
            await api('PATCH', '/api/control-todos', {
                id: pendingCompleteId,
                action: 'complete',
                completed_by: completedBy
            });
            document.getElementById('todo-complete-modal').classList.remove('active');
            showToast('success', 'Complétée', 'Tâche marquée comme complétée.');

            // Also close detail modal if open
            document.getElementById('todo-detail-modal').classList.remove('active');

            loadTodos();
        } catch(e) {
            showToast('error', 'Erreur', e.message);
        }
    }

    // ---- Detail ----

    async function openDetail(id) {
        currentDetailId = id;
        try {
            var data = await api('GET', '/api/control-todos?id=' + id);
            Object.assign(todoEmployees, data.employees || {});

            var t = data;
            var p = PRIORITIES[t.priority] || PRIORITIES[2];
            var overdue = isOverdue(t);

            var html = '';

            // Info grid
            html += '<div class="todo-detail-grid">';
            html += '<div class="todo-detail-row"><span class="todo-detail-label">Priorité</span><span class="todo-detail-value"><span class="todo-priority-badge" style="background:' + p.color + ';">' + p.label + '</span></span></div>';
            html += '<div class="todo-detail-row"><span class="todo-detail-label">Catégorie</span><span class="todo-detail-value">' + escHtml(t.category || 'Autre') + '</span></div>';
            if (t.created_by) html += '<div class="todo-detail-row"><span class="todo-detail-label">Créée par</span><span class="todo-detail-value">' + escHtml(empName(t.created_by)) + '</span></div>';
            if (t.assigned_to) html += '<div class="todo-detail-row"><span class="todo-detail-label">Assignée à</span><span class="todo-detail-value">' + escHtml(empName(t.assigned_to)) + '</span></div>';
            if (t.due_date) {
                var dueClass = overdue ? ' style="color:var(--danger);font-weight:600;"' : '';
                html += '<div class="todo-detail-row"><span class="todo-detail-label">Date limite</span><span class="todo-detail-value"' + dueClass + '>' + formatDate(t.due_date) + (overdue ? ' (EN RETARD)' : '') + '</span></div>';
            }
            if (t.vehicle) {
                var vLabel = t.vehicle.make + (t.vehicle.model ? ' ' + t.vehicle.model : '') + (t.vehicle.plate ? ' - ' + t.vehicle.plate : '');
                html += '<div class="todo-detail-row"><span class="todo-detail-label">Véhicule</span><span class="todo-detail-value"><a href="#" onclick="event.preventDefault();document.getElementById(\'todo-detail-modal\').classList.remove(\'active\');Control.openVehicleDetail(\'' + t.vehicle.id + '\')" style="color:var(--accent);">' + escHtml(vLabel) + '</a></span></div>';
            }
            if (t.completed_at) {
                html += '<div class="todo-detail-row"><span class="todo-detail-label">Complétée</span><span class="todo-detail-value" style="color:var(--success);">' + formatDateTime(t.completed_at) + (t.completed_by ? ' par ' + escHtml(empName(t.completed_by)) : '') + '</span></div>';
            }
            html += '<div class="todo-detail-row"><span class="todo-detail-label">Créée le</span><span class="todo-detail-value">' + formatDateTime(t.created_at) + '</span></div>';
            html += '</div>';

            // Description
            if (t.description) {
                html += '<div class="todo-detail-desc">' + escHtml(t.description).replace(/\n/g, '<br>') + '</div>';
            }

            // Notes section
            html += '<div class="todo-notes-section">';
            html += '<h3 style="font-size:0.95rem;margin-bottom:12px;">Notes</h3>';
            html += '<div class="todo-notes-input"><textarea id="todo-note-text" rows="2" placeholder="Ajouter une note..."></textarea>';
            html += '<button class="btn btn--primary" onclick="Todos.addNote()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>';
            html += '<div id="todo-notes-list">';
            if (t.notes && t.notes.length > 0) {
                t.notes.forEach(function(n) {
                    html += '<div class="todo-note-item"><button class="todo-note-item__delete" onclick="Todos.deleteNote(\'' + n.id + '\')">&times;</button><div class="todo-note-item__date">' + formatDateTime(n.created_at) + '</div><div class="todo-note-item__text">' + escHtml(n.text) + '</div></div>';
                });
            } else {
                html += '<p style="color:var(--text-muted);font-size:0.85rem;">Aucune note.</p>';
            }
            html += '</div></div>';

            document.getElementById('todo-detail-title').textContent = t.title;
            document.getElementById('todo-detail-body').innerHTML = html;

            // Footer buttons
            var footer = '';
            if (!t.completed_at) {
                footer += '<button class="btn btn--ghost" onclick="Todos.editFromDetail(\'' + t.id + '\')">Modifier</button>';
                footer += '<button class="btn btn--primary" onclick="Todos.promptComplete(\'' + t.id + '\')">Compléter</button>';
            } else {
                footer += '<button class="btn btn--ghost" onclick="Todos.reopenTodo(\'' + t.id + '\')">Réouvrir</button>';
            }
            footer += '<button class="btn btn--ghost icon-btn--danger" style="margin-left:auto;color:var(--danger);" onclick="Todos.deleteTodo(\'' + t.id + '\')">Supprimer</button>';
            document.getElementById('todo-detail-footer').innerHTML = footer;

            document.getElementById('todo-detail-modal').classList.add('active');

            // Note input enter key
            setTimeout(function() {
                var noteInput = document.getElementById('todo-note-text');
                if (noteInput) {
                    noteInput.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            addNote();
                        }
                    });
                }
            }, 50);
        } catch(e) {
            showToast('error', 'Erreur', e.message);
        }
    }

    async function editFromDetail(id) {
        document.getElementById('todo-detail-modal').classList.remove('active');
        var todo = allTodos.find(function(t) { return t.id === id; }) || completedTodos.find(function(t) { return t.id === id; });
        if (todo) {
            openTodoModal(todo);
        }
    }

    // ---- Notes ----

    async function addNote() {
        var text = document.getElementById('todo-note-text').value.trim();
        if (!text || !currentDetailId) return;
        try {
            await api('POST', '/api/control-todos', { action: 'add_note', todo_id: currentDetailId, text: text });
            openDetail(currentDetailId);
        } catch(e) { showToast('error', 'Erreur', e.message); }
    }

    async function deleteNote(noteId) {
        try {
            await api('DELETE', '/api/control-todos?note_id=' + noteId);
            openDetail(currentDetailId);
        } catch(e) { showToast('error', 'Erreur', e.message); }
    }

    // ---- Reopen / Delete ----

    async function reopenTodo(id) {
        try {
            await api('PATCH', '/api/control-todos', { id: id, action: 'reopen' });
            document.getElementById('todo-detail-modal').classList.remove('active');
            showToast('success', 'Réouverte', 'Tâche réouverte.');
            loadTodos();
        } catch(e) { showToast('error', 'Erreur', e.message); }
    }

    async function deleteTodo(id) {
        if (!confirm('Supprimer cette tâche ? Cette action est irréversible.')) return;
        try {
            await api('DELETE', '/api/control-todos?id=' + id);
            document.getElementById('todo-detail-modal').classList.remove('active');
            showToast('success', 'Supprimée', 'Tâche supprimée.');
            loadTodos();
        } catch(e) { showToast('error', 'Erreur', e.message); }
    }

    // ---- Init ----

    function init() {
        // New todo button
        document.getElementById('btn-new-todo').addEventListener('click', function() {
            loadDropdownData().then(function() { openTodoModal(null); });
        });

        // Vehicle search
        initVehicleSearch();

        // Modal close/save
        document.getElementById('todo-modal-close').addEventListener('click', function() { document.getElementById('todo-modal').classList.remove('active'); });
        document.getElementById('todo-modal-cancel').addEventListener('click', function() { document.getElementById('todo-modal').classList.remove('active'); });
        document.getElementById('todo-modal-save').addEventListener('click', saveTodo);

        // Detail modal
        document.getElementById('todo-detail-close').addEventListener('click', function() { document.getElementById('todo-detail-modal').classList.remove('active'); });

        // Complete modal
        document.getElementById('todo-complete-close').addEventListener('click', function() { document.getElementById('todo-complete-modal').classList.remove('active'); });
        document.getElementById('todo-complete-cancel').addEventListener('click', function() { document.getElementById('todo-complete-modal').classList.remove('active'); });
        document.getElementById('todo-complete-confirm').addEventListener('click', confirmComplete);

        // Completed toggle
        document.getElementById('todo-completed-toggle').addEventListener('click', function() {
            completedVisible = !completedVisible;
            var list = document.getElementById('todo-completed-list');
            var arrow = this.querySelector('.todo-section__arrow');
            list.style.display = completedVisible ? '' : 'none';
            if (arrow) arrow.style.transform = completedVisible ? 'rotate(180deg)' : '';
        });

        // Filters
        ['todo-filter-priority', 'todo-filter-category', 'todo-filter-assignee', 'todo-sort'].forEach(function(id) {
            document.getElementById(id).addEventListener('change', renderActiveTodos);
        });

        // Initial load only if authenticated
        var dash = document.getElementById('dashboard');
        if (dash && dash.style.display !== 'none') {
            // If todos tab is already active (session restore happened before this script loaded)
            var todosTab = document.getElementById('tab-todos');
            if (todosTab && todosTab.classList.contains('active')) {
                loadDropdownData();
                loadTodos();
            } else {
                api('GET', '/api/control-todos?count=true').then(function(data) {
                    var badge = document.getElementById('todo-sidebar-badge');
                    if (badge && data.count > 0) {
                        badge.textContent = data.count;
                        badge.style.display = '';
                    }
                }).catch(function() {});
            }
            startTodoPolling();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ---- Public API ----
    window.Todos = {
        loadTodos: function() { loadDropdownData(); loadTodos(); },
        openDetail: openDetail,
        promptComplete: promptComplete,
        editFromDetail: editFromDetail,
        addNote: addNote,
        deleteNote: deleteNote,
        reopenTodo: reopenTodo,
        deleteTodo: deleteTodo,
        ensurePolling: function() {
            if (!todoPollingInterval) {
                api('GET', '/api/control-todos?count=true').then(function(data) {
                    var badge = document.getElementById('todo-sidebar-badge');
                    if (badge && data.count > 0) { badge.textContent = data.count; badge.style.display = ''; }
                }).catch(function() {});
                startTodoPolling();
            }
        }
    };

})();
