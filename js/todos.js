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
        var stateClass = overdue ? ' todo-card--overdue' : (dueSoon ? ' todo-card--due-soon' : '');
        if (isCompleted) stateClass += ' todo-card--completed';

        var html = '<div class="todo-card' + stateClass + '" onclick="Todos.openDetail(\'' + t.id + '\')">';

        // Priority accent bar (left edge)
        html += '<div class="todo-card__accent" style="background:' + p.color + ';"></div>';

        // Main body
        html += '<div class="todo-card__body">';

        // Header row: priority label + category + date
        html += '<div class="todo-card__header">';
        html += '<span class="todo-card__priority" style="color:' + p.color + ';">' + p.label + '</span>';
        if (t.category) html += '<span class="todo-card__category">' + escHtml(t.category) + '</span>';
        if (t.due_date) {
            var dateClass = overdue ? ' todo-card__date--overdue' : (dueSoon ? ' todo-card__date--soon' : '');
            html += '<span class="todo-card__date' + dateClass + '">' + (overdue ? 'En retard · ' : '') + formatDate(t.due_date) + '</span>';
        }
        html += '</div>';

        // Title
        html += '<div class="todo-card__title">' + escHtml(t.title) + '</div>';

        // Description preview
        if (t.description) {
            var preview = t.description.length > 100 ? t.description.substring(0, 100) + '…' : t.description;
            html += '<div class="todo-card__desc">' + escHtml(preview) + '</div>';
        }

        // Footer: assignee, vehicle, completed info
        var hasFooter = (t.assigned_to && empName(t.assigned_to)) || (t.vehicle_id && vehLabel(t.vehicle_id)) || (isCompleted && t.completed_by);
        if (hasFooter) {
            html += '<div class="todo-card__footer">';
            if (t.assigned_to && empName(t.assigned_to)) {
                html += '<span class="todo-card__chip todo-card__chip--person">' + escHtml(empName(t.assigned_to)) + '</span>';
            }
            if (t.vehicle_id && vehLabel(t.vehicle_id)) {
                html += '<span class="todo-card__chip todo-card__chip--vehicle">' + escHtml(vehLabel(t.vehicle_id)) + '</span>';
            }
            if (isCompleted && t.completed_by) {
                html += '<span class="todo-card__chip todo-card__chip--done todo-card__chip--right">Complétée par ' + escHtml(empName(t.completed_by)) + '</span>';
            }
            html += '</div>';
        }

        html += '</div>'; // end body

        // Complete button
        if (!isCompleted) {
            html += '<button class="todo-card__check" onclick="event.stopPropagation();Todos.promptComplete(\'' + t.id + '\')" title="Compléter"></button>';
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

            // Subheader bar: created by (left) + date (right)
            html += '<div class="todo-detail__sub">';
            html += '<span class="todo-detail__sub-left">' + (t.created_by ? escHtml(empName(t.created_by)) : '') + '</span>';
            html += '<span class="todo-detail__sub-right">' + formatDateTime(t.created_at) + '</span>';
            html += '</div>';

            // Status banner for overdue
            if (overdue) {
                html += '<div class="todo-detail__status todo-detail__status--overdue">En retard</div>';
            } else if (t.completed_at) {
                html += '<div class="todo-detail__status todo-detail__status--done">Complétée par ' + (t.completed_by ? escHtml(empName(t.completed_by)) : '') + '</div>';
            }

            // Info cards
            html += '<div class="todo-detail__info">';

            html += '<div class="todo-detail__card">';
            html += '<div class="todo-detail__card-label">Catégorie</div>';
            html += '<div class="todo-detail__card-value">' + escHtml(t.category || 'Autre') + '</div>';
            html += '</div>';

            html += '<div class="todo-detail__card">';
            html += '<div class="todo-detail__card-label">Assignée à</div>';
            html += '<div class="todo-detail__card-value">' + (t.assigned_to ? escHtml(empName(t.assigned_to)) : '<span class="todo-detail__empty">—</span>') + '</div>';
            html += '</div>';

            html += '<div class="todo-detail__card' + (overdue ? ' todo-detail__card--danger' : '') + '">';
            html += '<div class="todo-detail__card-label">Date limite</div>';
            html += '<div class="todo-detail__card-value">' + (t.due_date ? formatDate(t.due_date) : '<span class="todo-detail__empty">—</span>') + '</div>';
            html += '</div>';

            var vLabel = '';
            if (t.vehicle) {
                vLabel = t.vehicle.make + (t.vehicle.model ? ' ' + t.vehicle.model : '') + (t.vehicle.plate ? ' - ' + t.vehicle.plate : '');
            }
            html += '<div class="todo-detail__card' + (t.vehicle ? ' todo-detail__card--link" onclick="event.stopPropagation();document.getElementById(\'todo-detail-modal\').classList.remove(\'active\');Control.openVehicleDetail(\'' + t.vehicle.id + '\')"' : '"') + '>';
            html += '<div class="todo-detail__card-label">Véhicule</div>';
            html += '<div class="todo-detail__card-value">' + (t.vehicle ? escHtml(vLabel) : '<span class="todo-detail__empty">—</span>') + '</div>';
            html += '</div>';

            if (t.completed_at) {
                html += '<div class="todo-detail__card todo-detail__card--success">';
                html += '<div class="todo-detail__card-label">Complétée par</div>';
                html += '<div class="todo-detail__card-value">' + (t.completed_by ? escHtml(empName(t.completed_by)) + ' · ' : '') + formatDateTime(t.completed_at) + '</div>';
                html += '</div>';
            }

            html += '</div>'; // end info

            // Description
            if (t.description) {
                html += '<div class="todo-detail__section">';
                html += '<div class="todo-detail__section-title">Description</div>';
                html += '<div class="todo-detail__desc">' + escHtml(t.description).replace(/\n/g, '<br>') + '</div>';
                html += '</div>';
            }

            // Notes section
            html += '<div class="todo-detail__section">';
            html += '<div class="todo-detail__section-title">Notes <span class="todo-detail__section-count">' + (t.notes ? t.notes.length : 0) + '</span></div>';

            // Note input
            html += '<div class="todo-notes__compose">';
            html += '<textarea id="todo-note-text" rows="1" placeholder="Écrire une note..."></textarea>';
            html += '<button class="todo-notes__send" onclick="Todos.addNote()" title="Envoyer">Envoyer</button>';
            html += '</div>';

            // Notes list
            html += '<div class="todo-notes__list" id="todo-notes-list">';
            if (t.notes && t.notes.length > 0) {
                t.notes.forEach(function(n) {
                    html += '<div class="todo-notes__item">';
                    html += '<div class="todo-notes__item-header">';
                    html += '<span class="todo-notes__item-date">' + formatDateTime(n.created_at) + '</span>';
                    html += '<button class="todo-notes__item-delete" onclick="event.stopPropagation();Todos.deleteNote(\'' + n.id + '\')">Supprimer</button>';
                    html += '</div>';
                    html += '<div class="todo-notes__item-text">' + escHtml(n.text) + '</div>';
                    html += '</div>';
                });
            } else {
                html += '<div class="todo-notes__empty">Aucune note pour cette tâche.</div>';
            }
            html += '</div></div>';

            document.getElementById('todo-detail-title').textContent = t.title;
            document.getElementById('todo-detail-body').innerHTML = html;

            // Priority accent on modal top
            var detailModal = document.getElementById('todo-detail-modal').querySelector('.modal');
            detailModal.style.borderTop = '3px solid ' + p.color;

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

    var pendingDeleteId = null;

    function deleteTodo(id) {
        pendingDeleteId = id;
        document.getElementById('todo-delete-modal').classList.add('active');
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        try {
            await api('DELETE', '/api/control-todos?id=' + pendingDeleteId);
            document.getElementById('todo-delete-modal').classList.remove('active');
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

        // Delete modal
        document.getElementById('todo-delete-cancel').addEventListener('click', function() { document.getElementById('todo-delete-modal').classList.remove('active'); });
        document.getElementById('todo-delete-confirm').addEventListener('click', confirmDelete);

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
