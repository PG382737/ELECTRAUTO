// ================================================
// Control Module — NFC Time Tracking System
// ================================================

(function() {
    'use strict';

    var CONTROL_HASH = 'a0daef58a503654eda4b9a42226ac19838dbb66aa3d90c4458f42df729bd2aaa';
    var controlUnlocked = false;
    var currentEmpStatsId = null;
    var currentVehDetailId = null;
    var deleteCallback = null;
    var liveTimers = {};
    var scannerInterval = null;
    var scannerTimeout = null;
    var scannerState = null;
    var scannerVehicle = null;
    var scannerActiveOrder = null;
    var nfcReader = null;
    var nfcAssignCallback = null;
    var empPage = 0;
    var vehPage = 0;
    var vehSearchQuery = '';
    var allEmployees = [];
    var allVehicles = [];
    var PAGE_SIZE = 20;

    // ---- Helpers ----

    function escHtml(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function formatDuration(seconds) {
        if (!seconds || seconds < 0) return '0s';
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = Math.floor(seconds % 60);
        if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'min';
        if (m > 0) return m + 'min ' + String(s).padStart(2, '0') + 's';
        return s + 's';
    }

    function formatDurationLong(seconds) {
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = Math.floor(seconds % 60);
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function formatDate(iso) {
        if (!iso) return '—';
        var parts = iso.substring(0, 10).split('-');
        return parts[2] + '-' + parts[1] + '-' + parts[0];
    }

    function formatDateTime(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }) + ' à ' +
               d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
    }

    // ---- Field validation with shake ----
    function shakeField(inputId) {
        var el = document.getElementById(inputId);
        if (!el) return;
        el.classList.remove('field-error');
        void el.offsetWidth; // force reflow to restart animation
        el.classList.add('field-error');
    }

    function isFieldValid(f) {
        var el = document.getElementById(f.id);
        if (!el) return true;
        var val = el.value.trim();
        if (f.required && !val) return false;
        if (f.minLength && val && val.length < f.minLength) return false;
        if (f.pattern && val && !f.pattern.test(val)) return false;
        return true;
    }

    function validateFields(fields) {
        var valid = true;
        fields.forEach(function(f) {
            var el = document.getElementById(f.id);
            if (!el) return;
            if (!isFieldValid(f)) {
                shakeField(f.id);
                valid = false;
                // Add live re-validation listener
                if (!el._validating) {
                    el._validating = true;
                    el.addEventListener('input', function handler() {
                        if (isFieldValid(f)) {
                            el.classList.remove('field-error');
                            el.removeEventListener('input', handler);
                            el._validating = false;
                        }
                    });
                }
            } else {
                el.classList.remove('field-error');
            }
        });
        return valid;
    }

    // dd-mm-yyyy <-> yyyy-mm-dd
    function hireDateToDisplay(isoDate) {
        if (!isoDate) return '';
        var p = isoDate.substring(0, 10).split('-');
        return p[2] + '-' + p[1] + '-' + p[0];
    }
    function hireDateToApi(displayDate) {
        if (!displayDate) return '';
        var p = displayDate.split('-');
        if (p.length !== 3) return displayDate;
        return p[2] + '-' + p[1] + '-' + p[0];
    }

    // Auto-format hire date input (add dashes)
    function initHireDateFormat() {
        var input = document.getElementById('emp-hire-date');
        if (!input) return;
        input.addEventListener('input', function() {
            var v = input.value.replace(/[^\d]/g, '');
            if (v.length > 2) v = v.substring(0, 2) + '-' + v.substring(2);
            if (v.length > 5) v = v.substring(0, 5) + '-' + v.substring(5);
            if (v.length > 10) v = v.substring(0, 10);
            input.value = v;
        });
    }

    // Input validation for vehicle fields
    function initVehicleValidation() {
        var yearInput = document.getElementById('veh-year');
        if (yearInput) {
            yearInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^\d]/g, '');
            });
        }
        var phoneInput = document.getElementById('veh-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', function() {
                var v = this.value.replace(/[^\d]/g, '');
                if (v.length > 3 && v.length <= 6) v = v.substring(0, 3) + '-' + v.substring(3);
                else if (v.length > 6) v = v.substring(0, 3) + '-' + v.substring(3, 6) + '-' + v.substring(6, 10);
                this.value = v;
            });
        }
        var vinInput = document.getElementById('veh-vin');
        if (vinInput) {
            vinInput.addEventListener('input', function() {
                this.value = this.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
            });
        }
    }

    function renderPagination(currentPage, totalPages, fnName) {
        var html = '<div class="control-pagination">';
        html += '<button class="btn btn--ghost btn--sm" ' + (currentPage === 0 ? 'disabled' : 'onclick="' + fnName + '(' + (currentPage - 1) + ')"') + '>&laquo; Précédent</button>';
        html += '<span class="control-pagination__info">Page ' + (currentPage + 1) + ' / ' + totalPages + '</span>';
        html += '<button class="btn btn--ghost btn--sm" ' + (currentPage >= totalPages - 1 ? 'disabled' : 'onclick="' + fnName + '(' + (currentPage + 1) + ')"') + '>Suivant &raquo;</button>';
        html += '</div>';
        return html;
    }

    async function sha256(str) {
        var buf = new TextEncoder().encode(str);
        var hashBuf = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hashBuf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    function clearAllTimers() {
        Object.keys(liveTimers).forEach(function(k) {
            clearInterval(liveTimers[k]);
            delete liveTimers[k];
        });
    }

    // ---- PASSWORD GATE ----

    function initGate() {
        var pwdInput = document.getElementById('control-pwd');
        var pwdBtn = document.getElementById('control-pwd-btn');
        var pwdError = document.getElementById('control-pwd-error');

        if (!pwdBtn) return;

        // Check sessionStorage
        if (sessionStorage.getItem('control-unlocked') === '1') {
            unlockControl();
            return;
        }

        async function tryUnlock() {
            var pwd = pwdInput.value;
            if (!pwd) return;
            var hash = await sha256(pwd);
            if (hash === CONTROL_HASH) {
                sessionStorage.setItem('control-unlocked', '1');
                unlockControl();
            } else {
                pwdError.textContent = 'Mot de passe incorrect.';
                pwdInput.value = '';
                pwdInput.focus();
            }
        }

        pwdBtn.addEventListener('click', tryUnlock);
        pwdInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') tryUnlock();
        });
    }

    function unlockControl() {
        controlUnlocked = true;
        var gate = document.getElementById('control-gate');
        var content = document.getElementById('control-content');
        if (gate) gate.style.display = 'none';
        if (content) content.style.display = 'block';
        loadEmployees();
    }

    // ---- SUB-TAB SWITCHING ----

    function initSubtabs() {
        document.querySelectorAll('.control-subtab').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.control-subtab').forEach(function(b) { b.classList.remove('active'); });
                document.querySelectorAll('.control-panel').forEach(function(p) { p.classList.remove('active'); });
                btn.classList.add('active');
                var target = btn.getAttribute('data-subtab');
                if (target === 'employees') {
                    document.getElementById('panel-employees').classList.add('active');
                    loadEmployees();
                } else if (target === 'vehicles') {
                    document.getElementById('panel-vehicles').classList.add('active');
                    loadVehicles();
                } else if (target === 'scanner') {
                    document.getElementById('panel-scanner').classList.add('active');
                }
            });
        });
    }

    // ---- EMPLOYEES ----

    async function loadEmployees() {
        var container = document.getElementById('employees-list');
        if (!container) return;
        try {
            allEmployees = await api('GET', '/api/control-employees');
            empPage = 0;
            renderEmployees();
        } catch(e) {
            container.innerHTML = '<div class="control-empty"><p>Erreur: ' + escHtml(e.message) + '</p></div>';
        }
    }

    function renderEmployees() {
        var container = document.getElementById('employees-list');
        var data = allEmployees;
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="control-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>Aucun employé. Ajoutez votre premier employé.</p></div>';
            return;
        }
        var totalPages = Math.ceil(data.length / PAGE_SIZE);
        var page = Math.min(empPage, totalPages - 1);
        var start = page * PAGE_SIZE;
        var pageData = data.slice(start, start + PAGE_SIZE);

        var html = '<table class="control-table"><thead><tr><th>Nom</th><th>Date d\'embauche</th><th>Badge NFC</th><th style="text-align:right;">Actions</th></tr></thead><tbody>';
        pageData.forEach(function(emp) {
            var nfcBadge = emp.nfc_tag_id
                ? '<span class="nfc-badge nfc-badge--assigned">Assigné</span>'
                : '<span class="nfc-badge nfc-badge--unassigned">Non assigné</span>';
            html += '<tr>';
            html += '<td class="col-name clickable-row" onclick="Control.openEmployeeStats(\'' + emp.id + '\')">' + escHtml(emp.first_name + ' ' + emp.last_name) + '</td>';
            html += '<td>' + formatDate(emp.hire_date) + '</td>';
            html += '<td>' + nfcBadge + '</td>';
            html += '<td><div class="col-actions">';
            html += '<button class="btn btn--ghost btn--sm" onclick="Control.openEmployeeStats(\'' + emp.id + '\')">Stats</button>';
            html += '<button class="btn btn--ghost btn--sm" onclick="Control.editEmployee(\'' + emp.id + '\')">Modifier</button>';
            html += '<button class="btn btn--danger btn--sm" onclick="Control.deleteEmployee(\'' + emp.id + '\')">Supprimer</button>';
            html += '</div></td>';
            html += '</tr>';
        });
        html += '</tbody></table>';

        if (totalPages > 1) {
            html += renderPagination(page, totalPages, 'Control.empGoTo');
        }
        container.innerHTML = html;
    }

    function empGoTo(p) { empPage = p; renderEmployees(); }

    function clearFieldErrors(ids) {
        ids.forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { el.classList.remove('field-error'); el._validating = false; }
        });
    }

    function openEmployeeModal(emp) {
        document.getElementById('employee-modal-title').textContent = emp ? 'Modifier l\'employé' : 'Nouvel employé';
        document.getElementById('emp-edit-id').value = emp ? emp.id : '';
        document.getElementById('emp-first-name').value = emp ? emp.first_name : '';
        document.getElementById('emp-last-name').value = emp ? emp.last_name : '';
        document.getElementById('emp-hire-date').value = emp && emp.hire_date ? hireDateToDisplay(emp.hire_date) : '';
        document.getElementById('emp-nfc-tag').value = emp && emp.nfc_tag_id ? emp.nfc_tag_id : '';
        document.getElementById('emp-clear-nfc').style.display = emp && emp.nfc_tag_id ? 'inline-flex' : 'none';
        clearFieldErrors(['emp-first-name', 'emp-last-name', 'emp-hire-date']);
        document.getElementById('employee-modal').classList.add('active');
    }

    async function saveEmployee() {
        var id = document.getElementById('emp-edit-id').value;
        var body = {
            first_name: document.getElementById('emp-first-name').value.trim(),
            last_name: document.getElementById('emp-last-name').value.trim(),
            hire_date: hireDateToApi(document.getElementById('emp-hire-date').value),
            nfc_tag_id: document.getElementById('emp-nfc-tag').value || null
        };

        var isValid = validateFields([
            { id: 'emp-first-name', required: true },
            { id: 'emp-last-name', required: true },
            { id: 'emp-hire-date', required: true, pattern: /^\d{2}-\d{2}-\d{4}$/ }
        ]);
        if (!isValid) return;

        try {
            if (id) {
                body.id = id;
                await api('PATCH', '/api/control-employees', body);
            } else {
                await api('POST', '/api/control-employees', body);
            }
            document.getElementById('employee-modal').classList.remove('active');
            loadEmployees();
        } catch(e) {
            alert('Erreur: ' + e.message);
        }
    }

    async function editEmployee(id) {
        try {
            var emp = await api('GET', '/api/control-employees?id=' + id);
            openEmployeeModal(emp);
        } catch(e) {
            alert('Erreur: ' + e.message);
        }
    }

    function deleteEmployee(id) {
        showConfirmDelete('Supprimer cet employé ?', 'L\'employé et tout son historique seront supprimés.', async function() {
            try {
                await api('DELETE', '/api/control-employees?id=' + id);
                loadEmployees();
            } catch(e) { alert('Erreur: ' + e.message); }
        });
    }

    // ---- EMPLOYEE STATS ----

    async function openEmployeeStats(id) {
        currentEmpStatsId = id;
        try {
            var emp = await api('GET', '/api/control-employees?id=' + id);
            document.getElementById('emp-stats-title').textContent = emp.first_name + ' ' + emp.last_name;
            document.getElementById('employee-stats-modal').classList.add('active');
            // Set default period to month
            document.querySelectorAll('#emp-stats-periods .period-btn').forEach(function(b) { b.classList.remove('active'); });
            document.querySelector('#emp-stats-periods .period-btn[data-period="month"]').classList.add('active');
            loadEmployeeStats('month');
        } catch(e) {
            alert('Erreur: ' + e.message);
        }
    }

    async function loadEmployeeStats(period) {
        if (!currentEmpStatsId) return;
        try {
            var data = await api('GET', '/api/control-employees?stats=true&id=' + currentEmpStatsId + '&period=' + period);
            var stats = data.stats;

            document.getElementById('emp-stat-hours').textContent = formatDuration(stats.total_seconds);
            document.getElementById('emp-stat-vehicles').textContent = stats.vehicle_count;
            document.getElementById('emp-stat-avg').textContent = formatDuration(stats.avg_seconds_per_vehicle);

            // Render orders history
            var historyEl = document.getElementById('emp-stats-history');
            if (!data.orders || data.orders.length === 0) {
                historyEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;">Aucun bon de travail pour cette période.</p>';
                return;
            }

            var html = '<table class="control-table"><thead><tr><th>Date</th><th>Véhicule</th><th>Durée</th></tr></thead><tbody>';
            data.orders.forEach(function(o) {
                var vehName = o.vehicle ? (o.vehicle.make + (o.vehicle.plate ? ' — ' + o.vehicle.plate : '')) : 'Inconnu';
                html += '<tr><td>' + formatDateTime(o.started_at) + '</td><td>' + escHtml(vehName) + '</td><td>' + formatDuration(o.duration_seconds) + '</td></tr>';
            });
            html += '</tbody></table>';
            historyEl.innerHTML = html;
        } catch(e) {
            document.getElementById('emp-stats-history').innerHTML = '<p style="color:var(--danger);">Erreur: ' + escHtml(e.message) + '</p>';
        }
    }

    // ---- VEHICLES ----

    async function loadVehicles() {
        var container = document.getElementById('vehicles-list');
        if (!container) return;
        clearAllTimers();
        try {
            allVehicles = await api('GET', '/api/control-vehicles');
            vehPage = 0;
            renderVehicles();
        } catch(e) {
            container.innerHTML = '<div class="control-empty"><p>Erreur: ' + escHtml(e.message) + '</p></div>';
        }
    }

    function filterVehicles() {
        var q = vehSearchQuery.toLowerCase().trim();
        if (!q) return allVehicles;
        return allVehicles.filter(function(v) {
            return (v.make || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.owner_name || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.phone || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.plate || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.vin || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.reference || '').toLowerCase().indexOf(q) !== -1;
        });
    }

    function renderVehicles() {
        var container = document.getElementById('vehicles-list');
        clearAllTimers();
        var filtered = filterVehicles();

        // Search bar
        var html = '<div class="control-search"><input type="text" id="veh-search-input" placeholder="Rechercher par véhicule, propriétaire, téléphone, plaque, NIV, référence..." value="' + escHtml(vehSearchQuery) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>';

        if (!filtered || filtered.length === 0) {
            if (vehSearchQuery) {
                html += '<div class="control-empty"><p>Aucun résultat pour « ' + escHtml(vehSearchQuery) + ' »</p></div>';
            } else {
                html += '<div class="control-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9"/></svg><p>Aucun véhicule. Ajoutez votre premier véhicule.</p></div>';
            }
            container.innerHTML = html;
            bindVehicleSearch();
            return;
        }

        var totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        var page = Math.min(vehPage, totalPages - 1);
        var start = page * PAGE_SIZE;
        var pageData = filtered.slice(start, start + PAGE_SIZE);

        html += '<table class="control-table"><thead><tr><th>Véhicule</th><th>Propriétaire</th><th>Plaque</th><th>Badge NFC</th><th>Statut</th><th style="text-align:right;">Actions</th></tr></thead><tbody>';
        pageData.forEach(function(v) {
            var nfcBadge = v.nfc_tag_id
                ? '<span class="nfc-badge nfc-badge--assigned">Assigné</span>'
                : '<span class="nfc-badge nfc-badge--unassigned">Non assigné</span>';

            var statusHtml = '';
            if (v.active_order) {
                var timerId = 'live-veh-' + v.id;
                var aoEmp = v.active_order.employee;
                var aoEmpName = aoEmp ? (aoEmp.first_name + ' ' + aoEmp.last_name) : '';
                statusHtml = '<span class="live-indicator"><span class="live-dot"></span><span class="live-timer" id="' + timerId + '">...</span>' + (aoEmpName ? '<span style="font-size:0.85rem;">' + escHtml(aoEmpName) + '</span>' : '') + '</span>';
                setTimeout(function() { startLiveTimer(timerId, v.active_order.started_at); }, 50);
            } else {
                statusHtml = '<span style="color:var(--text-muted);font-size:0.85rem;">—</span>';
            }

            html += '<tr>';
            html += '<td class="col-name clickable-row" onclick="Control.openVehicleDetail(\'' + v.id + '\')">' + escHtml(v.make) + (v.year ? ' ' + v.year : '') + (v.color ? ' <span style="color:var(--text-muted);">(' + escHtml(v.color) + ')</span>' : '') + '</td>';
            html += '<td>' + escHtml(v.owner_name) + '</td>';
            html += '<td>' + escHtml(v.plate || '—') + '</td>';
            html += '<td>' + nfcBadge + '</td>';
            html += '<td>' + statusHtml + '</td>';
            html += '<td><div class="col-actions">';
            html += '<button class="btn btn--ghost btn--sm" onclick="Control.openVehicleDetail(\'' + v.id + '\')">Détail</button>';
            html += '<button class="btn btn--ghost btn--sm" onclick="Control.editVehicle(\'' + v.id + '\')">Modifier</button>';
            html += '<button class="btn btn--danger btn--sm" onclick="Control.deleteVehicle(\'' + v.id + '\')">Supprimer</button>';
            html += '</div></td>';
            html += '</tr>';
        });
        html += '</tbody></table>';

        if (totalPages > 1) {
            html += renderPagination(page, totalPages, 'Control.vehGoTo');
        }
        container.innerHTML = html;
        bindVehicleSearch();
    }

    function bindVehicleSearch() {
        var input = document.getElementById('veh-search-input');
        if (!input) return;
        input.addEventListener('input', function() {
            vehSearchQuery = input.value;
            vehPage = 0;
            renderVehicles();
            // Re-focus and set cursor position
            var el = document.getElementById('veh-search-input');
            if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
        });
    }

    function vehGoTo(p) { vehPage = p; renderVehicles(); }

    function startLiveTimer(elementId, startedAt) {
        var el = document.getElementById(elementId);
        if (!el) return;
        var start = new Date(startedAt).getTime();
        function update() {
            var elapsed = Math.floor((Date.now() - start) / 1000);
            if (el) el.textContent = formatDurationLong(elapsed);
        }
        update();
        liveTimers[elementId] = setInterval(update, 1000);
    }

    function openVehicleModal(veh) {
        document.getElementById('vehicle-modal-title').textContent = veh ? 'Modifier le véhicule' : 'Nouveau véhicule';
        document.getElementById('veh-edit-id').value = veh ? veh.id : '';
        document.getElementById('veh-owner').value = veh ? veh.owner_name : '';
        document.getElementById('veh-phone').value = veh ? (veh.phone || '') : '';
        document.getElementById('veh-make').value = veh ? veh.make : '';
        document.getElementById('veh-color').value = veh ? (veh.color || '') : '';
        document.getElementById('veh-plate').value = veh ? (veh.plate || '') : '';
        document.getElementById('veh-year').value = veh ? (veh.year || '') : '';
        document.getElementById('veh-vin').value = veh ? (veh.vin || '') : '';
        document.getElementById('veh-reference').value = veh ? (veh.reference || '') : '';
        document.getElementById('veh-nfc-tag').value = veh && veh.nfc_tag_id ? veh.nfc_tag_id : '';
        document.getElementById('veh-clear-nfc').style.display = veh && veh.nfc_tag_id ? 'inline-flex' : 'none';

        // Reset photo preview
        var preview = document.getElementById('veh-photo-preview');
        if (veh && veh.photo_url) {
            preview.innerHTML = '<img src="' + escHtml(veh.photo_url) + '" style="width:100%;max-height:180px;object-fit:cover;border-radius:var(--radius-sm);">';
        } else {
            preview.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:40px;height:40px;color:var(--text-muted);"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><p style="color:var(--text-muted);font-size:0.85rem;margin-top:8px;">Cliquez pour ajouter une photo</p>';
        }
        document.getElementById('veh-photo-file').value = '';

        clearFieldErrors(['veh-owner', 'veh-make', 'veh-phone', 'veh-year', 'veh-vin']);
        document.getElementById('vehicle-modal').classList.add('active');
    }

    async function saveVehicle() {
        var id = document.getElementById('veh-edit-id').value;
        var body = {
            owner_name: document.getElementById('veh-owner').value.trim(),
            phone: document.getElementById('veh-phone').value.trim(),
            make: document.getElementById('veh-make').value.trim(),
            color: document.getElementById('veh-color').value.trim(),
            plate: document.getElementById('veh-plate').value.trim(),
            year: document.getElementById('veh-year').value.trim(),
            vin: document.getElementById('veh-vin').value.trim(),
            reference: document.getElementById('veh-reference').value.trim(),
            nfc_tag_id: document.getElementById('veh-nfc-tag').value || null
        };

        var isValid = validateFields([
            { id: 'veh-owner', required: true },
            { id: 'veh-make', required: true },
            { id: 'veh-phone', pattern: /^(\d{3}-\d{3}-\d{4})?$/ },
            { id: 'veh-year', pattern: /^(\d{4})?$/ },
            { id: 'veh-vin', minLength: 17 }
        ]);
        if (!isValid) return;

        // Handle photo upload
        var fileInput = document.getElementById('veh-photo-file');
        if (fileInput.files && fileInput.files[0]) {
            try {
                var file = fileInput.files[0];
                var reader = new FileReader();
                var base64 = await new Promise(function(resolve) {
                    reader.onload = function(e) { resolve(e.target.result.split(',')[1]); };
                    reader.readAsDataURL(file);
                });
                var uploadRes = await api('POST', '/api/upload-image', {
                    data: base64,
                    filename: file.name,
                    contentType: file.type,
                    bucket: 'control-photos'
                });
                body.photo_url = uploadRes.url;
            } catch(e) {
                alert('Erreur upload photo: ' + e.message);
                return;
            }
        }

        try {
            if (id) {
                body.id = id;
                await api('PATCH', '/api/control-vehicles', body);
            } else {
                await api('POST', '/api/control-vehicles', body);
            }
            document.getElementById('vehicle-modal').classList.remove('active');
            loadVehicles();
        } catch(e) {
            alert('Erreur: ' + e.message);
        }
    }

    async function editVehicle(id) {
        try {
            var res = await api('GET', '/api/control-vehicles?id=' + id);
            openVehicleModal(res.vehicle);
        } catch(e) {
            alert('Erreur: ' + e.message);
        }
    }

    function deleteVehicle(id) {
        showConfirmDelete('Supprimer ce véhicule ?', 'Le véhicule et tout son historique seront supprimés.', async function() {
            try {
                await api('DELETE', '/api/control-vehicles?id=' + id);
                loadVehicles();
            } catch(e) { alert('Erreur: ' + e.message); }
        });
    }

    // ---- VEHICLE DETAIL ----

    async function openVehicleDetail(id) {
        currentVehDetailId = id;
        clearAllTimers();
        try {
            var data = await api('GET', '/api/control-vehicles?id=' + id);
            var v = data.vehicle;
            var detailBody = document.getElementById('veh-detail-body');

            document.getElementById('veh-detail-title').textContent = v.make + (v.year ? ' ' + v.year : '') + (v.plate ? ' — ' + v.plate : '');

            var html = '';

            // Header with photo + info
            html += '<div class="veh-detail-header">';
            if (v.photo_url) {
                html += '<img src="' + escHtml(v.photo_url) + '" alt="Photo">';
            }
            html += '<div class="veh-detail-info">';
            html += '<h3>' + escHtml(v.make) + (v.year ? ' ' + v.year : '') + '</h3>';
            html += '<p><strong>Propriétaire:</strong> ' + escHtml(v.owner_name) + '</p>';
            if (v.phone) html += '<p><strong>Tél:</strong> ' + escHtml(v.phone) + '</p>';
            if (v.plate) html += '<p><strong>Plaque:</strong> ' + escHtml(v.plate) + '</p>';
            if (v.color) html += '<p><strong>Couleur:</strong> ' + escHtml(v.color) + '</p>';
            if (v.vin) html += '<p><strong>VIN:</strong> ' + escHtml(v.vin) + '</p>';
            html += '</div></div>';

            // Active work order
            if (data.active_order) {
                var ao = data.active_order;
                var empName = ao.employee ? (ao.employee.first_name + ' ' + ao.employee.last_name) : 'Inconnu';
                html += '<div class="veh-detail-active">';
                html += '<div class="veh-detail-active__timer-box"><div class="veh-detail-active__timer" id="veh-detail-timer">...</div><span>EN COURS</span></div>';
                html += '<div class="veh-detail-active__sep"></div>';
                html += '<div class="veh-detail-active__info"><span class="live-dot"></span><div><strong>' + escHtml(empName) + '</strong><p style="margin:4px 0 0;font-size:0.82rem;color:rgba(255,255,255,0.5);">Depuis ' + formatDateTime(ao.started_at) + '</p></div></div>';
                html += '</div>';
                setTimeout(function() { startLiveTimer('veh-detail-timer', ao.started_at); }, 50);
            }

            // Stats
            html += '<div class="stats-grid" style="margin-bottom:24px;">';
            html += '<div class="stat-card"><div class="stat-card__value">' + data.stats.total_repairs + '</div><div class="stat-card__label">Réparations</div></div>';
            html += '<div class="stat-card"><div class="stat-card__value">' + formatDuration(data.stats.total_seconds) + '</div><div class="stat-card__label">Temps total</div></div>';
            html += '<div class="stat-card"><div class="stat-card__value">' + data.stats.employee_count + '</div><div class="stat-card__label">Employés</div></div>';
            html += '</div>';

            // Work history
            html += '<h3 style="font-size:0.95rem;margin-bottom:12px;">Historique des travaux</h3>';
            var closedOrders = data.orders.filter(function(o) { return o.ended_at; });
            if (closedOrders.length === 0) {
                html += '<p style="color:var(--text-muted);font-size:0.88rem;">Aucun historique.</p>';
            } else {
                html += '<table class="control-table"><thead><tr><th>Date</th><th>Employé</th><th>Durée</th></tr></thead><tbody>';
                closedOrders.forEach(function(o) {
                    var empName = o.employee ? (o.employee.first_name + ' ' + o.employee.last_name) : 'Inconnu';
                    html += '<tr><td>' + formatDateTime(o.started_at) + '</td><td>' + escHtml(empName) + '</td><td>' + formatDuration(o.duration_seconds) + '</td></tr>';
                });
                html += '</tbody></table>';
            }

            // Notes
            html += '<div class="veh-notes">';
            html += '<h3 style="font-size:0.95rem;margin-bottom:12px;">Notes</h3>';
            html += '<div class="veh-notes__input">';
            html += '<textarea id="veh-note-text" rows="2" placeholder="Ajouter une note..."></textarea>';
            html += '<button class="btn btn--primary" onclick="Control.addVehicleNote()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>';
            html += '</div>';
            html += '<div id="veh-notes-list">';
            if (data.notes && data.notes.length > 0) {
                data.notes.forEach(function(n) {
                    html += renderVehicleNote(n);
                });
            } else {
                html += '<p style="color:var(--text-muted);font-size:0.85rem;">Aucune note.</p>';
            }
            html += '</div></div>';

            detailBody.innerHTML = html;
            document.getElementById('vehicle-detail-modal').classList.add('active');

            // Note input enter
            var noteInput = document.getElementById('veh-note-text');
            if (noteInput) {
                noteInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        addVehicleNote();
                    }
                });
            }
        } catch(e) {
            alert('Erreur: ' + e.message);
        }
    }

    function renderVehicleNote(n) {
        return '<div class="veh-note-item"><button class="veh-note-item__delete" onclick="Control.deleteVehicleNote(\'' + n.id + '\')">&times;</button><div class="veh-note-item__date">' + formatDateTime(n.created_at) + '</div><div class="veh-note-item__text">' + escHtml(n.text) + '</div></div>';
    }

    async function addVehicleNote() {
        var text = document.getElementById('veh-note-text').value.trim();
        if (!text || !currentVehDetailId) return;
        try {
            await api('POST', '/api/control-vehicle-notes', { vehicle_id: currentVehDetailId, text: text });
            openVehicleDetail(currentVehDetailId); // Refresh
        } catch(e) { alert('Erreur: ' + e.message); }
    }

    async function deleteVehicleNote(noteId) {
        try {
            await api('DELETE', '/api/control-vehicle-notes?id=' + noteId);
            openVehicleDetail(currentVehDetailId);
        } catch(e) { alert('Erreur: ' + e.message); }
    }

    // ---- CONFIRM DELETE ----

    function showConfirmDelete(title, msg, callback) {
        document.getElementById('control-confirm-title').textContent = title;
        document.getElementById('control-confirm-msg').textContent = msg;
        deleteCallback = callback;
        document.getElementById('control-confirm-modal').classList.add('active');
    }

    // ---- NFC ASSIGNMENT ----

    function assignNfc(callback) {
        if ('NDEFReader' in window) {
            nfcAssignCallback = callback;
            var reader = new NDEFReader();
            reader.scan().then(function() {
                reader.onreading = function(event) {
                    var tagId = event.serialNumber;
                    if (nfcAssignCallback) {
                        nfcAssignCallback(tagId);
                        nfcAssignCallback = null;
                    }
                };
            }).catch(function(err) {
                alert('Erreur NFC: ' + err.message);
            });
            alert('Approchez le badge NFC du lecteur...');
        } else {
            var tagId = prompt('NFC non disponible. Entrez manuellement l\'identifiant du badge:');
            if (tagId) callback(tagId);
        }
    }

    // ---- NFC SCANNER (FULLSCREEN) ----

    var SCANNER_NFC_ICON = '<svg class="nfc-scanner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="4"/><path d="M8 7v10M12 5v14M16 7v10"/></svg>';

    function openScanner() {
        var overlay = document.getElementById('nfc-scanner-overlay');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        setScannerState('WAITING_VEHICLE');
        startNfcListener();
    }

    function closeScanner() {
        var overlay = document.getElementById('nfc-scanner-overlay');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        stopNfcListener();
        clearScannerTimers();
        scannerState = null;
        scannerVehicle = null;
        scannerActiveOrder = null;
    }

    function clearScannerTimers() {
        if (scannerInterval) { clearInterval(scannerInterval); scannerInterval = null; }
        if (scannerTimeout) { clearTimeout(scannerTimeout); scannerTimeout = null; }
    }

    function setScannerState(state) {
        clearScannerTimers();
        scannerState = state;
        var content = document.getElementById('scanner-content');

        if (state === 'WAITING_VEHICLE') {
            scannerVehicle = null;
            scannerActiveOrder = null;
            content.innerHTML = '<div class="nfc-scanner__title">VÉHICULE</div>' + SCANNER_NFC_ICON + '<div class="nfc-scanner__subtitle">Scannez la carte NFC du véhicule</div>' + getScannerSimHtml();

        } else if (state === 'WAITING_EMPLOYEE') {
            var v = scannerVehicle;
            content.innerHTML = '<div class="nfc-scanner__info"><p><strong>' + escHtml(v.make) + (v.year ? ' ' + v.year : '') + '</strong></p>' + (v.plate ? '<p>Plaque: ' + escHtml(v.plate) + '</p>' : '') + '<p>Propriétaire: ' + escHtml(v.owner_name) + '</p></div><div class="nfc-scanner__title" style="margin-top:32px;">EMPLOYÉ</div>' + SCANNER_NFC_ICON + '<div class="nfc-scanner__subtitle">Scannez le badge de l\'employé</div>' + getScannerSimHtml();

        } else if (state === 'CLOSING_ORDER') {
            var v2 = scannerVehicle;
            var ao = scannerActiveOrder;
            var empName = ao.employee ? (ao.employee.first_name + ' ' + ao.employee.last_name) : 'Inconnu';
            content.innerHTML = '<div class="nfc-scanner__info"><p><strong>' + escHtml(v2.make) + (v2.year ? ' ' + v2.year : '') + '</strong></p>' + (v2.plate ? '<p>Plaque: ' + escHtml(v2.plate) + '</p>' : '') + '<p>Propriétaire: ' + escHtml(v2.owner_name) + '</p><p style="margin-top:8px;">Employé: <strong>' + escHtml(empName) + '</strong></p></div><div class="nfc-scanner__elapsed" id="scanner-elapsed">00:00:00</div><div class="nfc-scanner__title" style="font-size:4rem;margin-top:20px;">EMPLOYÉ</div>' + SCANNER_NFC_ICON + '<div class="nfc-scanner__subtitle">Scannez le badge pour fermer le bon de travail</div>' + getScannerSimHtml();
            setTimeout(function() { startScannerTimer(ao.started_at); }, 50);

        } else if (state === 'SUCCESS_OPEN') {
            content.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:80px;height:80px;color:var(--success);margin-bottom:20px;"><path d="M20 6L9 17l-5-5"/></svg><div class="nfc-scanner__success">Bon de travail commencé</div><div class="nfc-scanner__countdown" id="scanner-countdown">Retour dans 15 secondes...</div>';
            var countdown = 15;
            scannerInterval = setInterval(function() {
                countdown--;
                var el = document.getElementById('scanner-countdown');
                if (el) el.textContent = 'Retour dans ' + countdown + ' secondes...';
                if (countdown <= 0) setScannerState('WAITING_VEHICLE');
            }, 1000);

        } else if (state === 'SUCCESS_CLOSE') {
            content.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:80px;height:80px;color:var(--success);margin-bottom:20px;"><path d="M20 6L9 17l-5-5"/></svg><div class="nfc-scanner__success">Bon de travail terminé</div><div class="nfc-scanner__countdown" id="scanner-countdown">Retour dans 15 secondes...</div>';
            var countdown2 = 15;
            scannerInterval = setInterval(function() {
                countdown2--;
                var el = document.getElementById('scanner-countdown');
                if (el) el.textContent = 'Retour dans ' + countdown2 + ' secondes...';
                if (countdown2 <= 0) setScannerState('WAITING_VEHICLE');
            }, 1000);

        } else if (state === 'ERROR') {
            // Error state is set with custom content before calling this
        }
    }

    function getScannerSimHtml() {
        return '<div class="nfc-sim-input"><input type="text" id="nfc-sim-tag" placeholder="Tag NFC (simulation)"><button onclick="Control.simulateNfc()">Simuler</button></div>';
    }

    function startScannerTimer(startedAt) {
        var el = document.getElementById('scanner-elapsed');
        if (!el) return;
        var start = new Date(startedAt).getTime();
        function update() {
            var elapsed = Math.floor((Date.now() - start) / 1000);
            if (el) el.textContent = formatDurationLong(elapsed);
        }
        update();
        scannerInterval = setInterval(update, 1000);
    }

    function startNfcListener() {
        if (!('NDEFReader' in window)) return;
        try {
            nfcReader = new NDEFReader();
            nfcReader.scan().then(function() {
                nfcReader.onreading = function(event) {
                    handleNfcScan(event.serialNumber);
                };
            }).catch(function(err) {
                console.warn('NFC scan error:', err);
            });
        } catch(e) {
            console.warn('NFC not available:', e);
        }
    }

    function stopNfcListener() {
        nfcReader = null;
    }

    function simulateNfc() {
        var input = document.getElementById('nfc-sim-tag');
        if (input && input.value.trim()) {
            handleNfcScan(input.value.trim());
        }
    }

    async function handleNfcScan(tagId) {
        if (!scannerState) return;

        if (scannerState === 'WAITING_VEHICLE') {
            // Lookup vehicle by NFC
            try {
                var vehicle = await api('GET', '/api/control-vehicles?nfc=' + encodeURIComponent(tagId));
                scannerVehicle = vehicle;

                // Check for open work order
                var activeOrder = await api('GET', '/api/control-work-orders?vehicle_id=' + vehicle.id);
                if (activeOrder) {
                    scannerActiveOrder = activeOrder;
                    setScannerState('CLOSING_ORDER');
                } else {
                    setScannerState('WAITING_EMPLOYEE');
                }
            } catch(e) {
                showScannerError('Véhicule introuvable');
            }

        } else if (scannerState === 'WAITING_EMPLOYEE') {
            // Lookup employee by NFC
            try {
                var employee = await api('GET', '/api/control-employees?nfc=' + encodeURIComponent(tagId));
                // Start work order
                await api('POST', '/api/control-work-orders', {
                    vehicle_id: scannerVehicle.id,
                    employee_id: employee.id
                });
                setScannerState('SUCCESS_OPEN');
            } catch(e) {
                showScannerError('Employé introuvable');
            }

        } else if (scannerState === 'CLOSING_ORDER') {
            // Lookup employee and close order
            try {
                var emp = await api('GET', '/api/control-employees?nfc=' + encodeURIComponent(tagId));
                await api('PATCH', '/api/control-work-orders', { vehicle_id: scannerVehicle.id });
                setScannerState('SUCCESS_CLOSE');
            } catch(e) {
                showScannerError('Employé introuvable');
            }
        }
    }

    function showScannerError(msg) {
        var content = document.getElementById('scanner-content');
        var prevState = scannerState;
        clearScannerTimers();

        content.innerHTML = '<div class="nfc-scanner__error">' + escHtml(msg) + '</div>';
        scannerTimeout = setTimeout(function() {
            if (prevState === 'CLOSING_ORDER') {
                setScannerState('CLOSING_ORDER');
            } else if (prevState === 'WAITING_EMPLOYEE') {
                setScannerState('WAITING_EMPLOYEE');
            } else {
                setScannerState('WAITING_VEHICLE');
            }
        }, 3000);
    }

    // ---- PHOTO PREVIEW ----

    function initPhotoUpload() {
        var fileInput = document.getElementById('veh-photo-file');
        if (!fileInput) return;
        fileInput.addEventListener('change', function() {
            if (!fileInput.files || !fileInput.files[0]) return;
            var reader = new FileReader();
            reader.onload = function(e) {
                var preview = document.getElementById('veh-photo-preview');
                preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%;max-height:180px;object-fit:cover;border-radius:var(--radius-sm);">';
            };
            reader.readAsDataURL(fileInput.files[0]);
        });
    }

    // ---- INIT ----

    function init() {
        initGate();
        initSubtabs();
        initPhotoUpload();
        initHireDateFormat();
        initVehicleValidation();

        // Employee modal buttons
        var empModal = document.getElementById('employee-modal');
        document.getElementById('emp-cancel').addEventListener('click', function() { empModal.classList.remove('active'); });
        document.getElementById('employee-modal-close').addEventListener('click', function() { empModal.classList.remove('active'); });
        document.getElementById('emp-save').addEventListener('click', saveEmployee);
        document.getElementById('btn-new-employee').addEventListener('click', function() { openEmployeeModal(null); });
        empModal.addEventListener('click', function(e) { if (e.target === empModal) empModal.classList.remove('active'); });

        // Employee NFC assign
        document.getElementById('emp-assign-nfc').addEventListener('click', function() {
            assignNfc(function(tagId) {
                document.getElementById('emp-nfc-tag').value = tagId;
                document.getElementById('emp-clear-nfc').style.display = 'inline-flex';
            });
        });
        document.getElementById('emp-clear-nfc').addEventListener('click', async function() {
            var empId = document.getElementById('emp-edit-id').value;
            if (empId) {
                try {
                    var active = await api('GET', '/api/control-work-orders?active=true');
                    var hasOpen = active && active.some(function(o) { return o.employee_id === empId; });
                    if (hasOpen) {
                        alert('Impossible de retirer le badge : cet employé a un bon de travail ouvert.');
                        return;
                    }
                } catch(e) {}
            }
            document.getElementById('emp-nfc-tag').value = '';
            this.style.display = 'none';
        });

        // Employee stats modal
        var empStatsModal = document.getElementById('employee-stats-modal');
        document.getElementById('emp-stats-close').addEventListener('click', function() { empStatsModal.classList.remove('active'); });
        empStatsModal.addEventListener('click', function(e) { if (e.target === empStatsModal) empStatsModal.classList.remove('active'); });
        document.querySelectorAll('#emp-stats-periods .period-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('#emp-stats-periods .period-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                loadEmployeeStats(btn.getAttribute('data-period'));
            });
        });

        // Vehicle modal buttons
        var vehModal = document.getElementById('vehicle-modal');
        document.getElementById('veh-cancel').addEventListener('click', function() { vehModal.classList.remove('active'); });
        document.getElementById('vehicle-modal-close').addEventListener('click', function() { vehModal.classList.remove('active'); });
        document.getElementById('veh-save').addEventListener('click', saveVehicle);
        document.getElementById('btn-new-vehicle').addEventListener('click', function() { openVehicleModal(null); });
        vehModal.addEventListener('click', function(e) { if (e.target === vehModal) vehModal.classList.remove('active'); });

        // Vehicle NFC assign
        document.getElementById('veh-assign-nfc').addEventListener('click', function() {
            assignNfc(function(tagId) {
                document.getElementById('veh-nfc-tag').value = tagId;
                document.getElementById('veh-clear-nfc').style.display = 'inline-flex';
            });
        });
        document.getElementById('veh-clear-nfc').addEventListener('click', async function() {
            var vehId = document.getElementById('veh-edit-id').value;
            if (vehId) {
                try {
                    var active = await api('GET', '/api/control-work-orders?vehicle_id=' + vehId);
                    if (active) {
                        alert('Impossible de retirer le badge : ce véhicule a un bon de travail ouvert.');
                        return;
                    }
                } catch(e) {}
            }
            document.getElementById('veh-nfc-tag').value = '';
            this.style.display = 'none';
        });

        // Vehicle detail modal
        var vehDetailModal = document.getElementById('vehicle-detail-modal');
        document.getElementById('veh-detail-close').addEventListener('click', function() { vehDetailModal.classList.remove('active'); clearAllTimers(); });
        vehDetailModal.addEventListener('click', function(e) { if (e.target === vehDetailModal) { vehDetailModal.classList.remove('active'); clearAllTimers(); } });

        // Confirm delete modal
        var confirmModal = document.getElementById('control-confirm-modal');
        document.getElementById('control-confirm-close').addEventListener('click', function() { confirmModal.classList.remove('active'); });
        document.getElementById('control-cancel-delete').addEventListener('click', function() { confirmModal.classList.remove('active'); });
        document.getElementById('control-confirm-delete').addEventListener('click', function() {
            confirmModal.classList.remove('active');
            if (deleteCallback) { deleteCallback(); deleteCallback = null; }
        });
        confirmModal.addEventListener('click', function(e) { if (e.target === confirmModal) confirmModal.classList.remove('active'); });

        // Scanner
        document.getElementById('btn-open-scanner').addEventListener('click', openScanner);
        document.getElementById('scanner-close').addEventListener('click', closeScanner);
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.getElementById('nfc-scanner-overlay').classList.contains('active')) {
                closeScanner();
            }
        });
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ---- PUBLIC API (for onclick handlers) ----
    window.Control = {
        openEmployeeStats: openEmployeeStats,
        editEmployee: editEmployee,
        deleteEmployee: deleteEmployee,
        empGoTo: empGoTo,
        openVehicleDetail: openVehicleDetail,
        editVehicle: editVehicle,
        deleteVehicle: deleteVehicle,
        vehGoTo: vehGoTo,
        addVehicleNote: addVehicleNote,
        deleteVehicleNote: deleteVehicleNote,
        simulateNfc: simulateNfc
    };

})();
