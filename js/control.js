// ================================================
// Control Module - NFC Time Tracking System
// ================================================

(function() {
    'use strict';

    var currentEmpStatsId = null;
    var currentVehDetailId = null;
    var deleteCallback = null;
    var liveTimers = {};
    var dashboardOrderTimers = [];
    var dashboardOrdersInterval = null;
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
    var notifications = [];
    var notifPanelOpen = false;
    var knownOrderIds = {};
    var notifPollingInterval = null;
    var mediaClassifyMode = false;
    var mediaDeleteMode = false;
    var selectedMediaIds = {};

    // ---- Toast notifications ----

    function showToast(type, title, msg, duration) {
        var container = document.getElementById('toast-container');
        if (!container) return;
        duration = duration || 5000;
        var icons = {
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        var toast = document.createElement('div');
        toast.className = 'toast toast--' + type;
        toast.innerHTML = '<div class="toast__icon">' + (icons[type] || icons.info) + '</div>' +
            '<div class="toast__body"><div class="toast__title">' + escHtml(title) + '</div>' +
            (msg ? '<div class="toast__msg">' + escHtml(msg) + '</div>' : '') + '</div>' +
            '<button class="toast__close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
        container.appendChild(toast);
        var closeBtn = toast.querySelector('.toast__close');
        function removeToast() {
            toast.classList.add('toast--removing');
            setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
        }
        closeBtn.addEventListener('click', removeToast);
        setTimeout(removeToast, duration);
    }

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
        if (!seconds || seconds < 0) seconds = 0;
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = Math.floor(seconds % 60);
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function formatDate(iso) {
        if (!iso) return '-';
        var parts = iso.substring(0, 10).split('-');
        return parts[2] + '-' + parts[1] + '-' + parts[0];
    }

    function formatDateTime(iso) {
        if (!iso) return '-';
        var d = new Date(iso);
        return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }) + ' à ' +
               d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
    }

    // ===== PAUSE SCHEDULE (America/Toronto) =====
    var PAUSE_BOUNDS = {1:[480,720,780,1020],2:[480,720,780,1020],3:[480,720,780,1020],4:[480,720,780,1020],5:[480,720]};

    // Load custom pause bounds from settings
    (function loadPauseSettings() {
        api('GET', '/api/admin-settings').then(function(settings) {
            if (settings && settings.pause_bounds) {
                var pb = typeof settings.pause_bounds === 'string' ? JSON.parse(settings.pause_bounds) : settings.pause_bounds;
                // Convert string keys to numbers
                var converted = {};
                for (var k in pb) { converted[parseInt(k)] = pb[k]; }
                PAUSE_BOUNDS = converted;
            }
        }).catch(function() {});
    })();

    function isInPauseET(ms) {
        var et = new Date(new Date(ms).toLocaleString('en-US', { timeZone: 'America/Toronto' }));
        var day = et.getDay(); // 0=Dim, 1=Lun, ..., 5=Ven, 6=Sam
        var t = et.getHours() * 60 + et.getMinutes();
        if (day === 0 || day === 6) return true;
        if (day === 5) return t < 480 || t >= 720; // Ven: travail 8h-12h seulement
        return t < 480 || (t >= 720 && t < 780) || t >= 1020; // Lun-Jeu: 8-12, 13-17
    }

    function etMidnightUTC(year, month, date) {
        var d = new Date(year, month, date);
        var y = d.getFullYear(), mo = d.getMonth(), da = d.getDate();
        var offsets = [4, 5]; // EDT=UTC-4, EST=UTC-5
        for (var i = 0; i < offsets.length; i++) {
            var candidate = Date.UTC(y, mo, da, offsets[i], 0, 0, 0);
            var check = new Date(new Date(candidate).toLocaleString('en-US', { timeZone: 'America/Toronto' }));
            if (check.getHours() === 0 && check.getDate() === da && check.getMonth() === mo) return candidate;
        }
        return Date.UTC(y, mo, da, 4, 0, 0, 0);
    }

    function getNextTransitionET(ms) {
        var et = new Date(new Date(ms).toLocaleString('en-US', { timeZone: 'America/Toronto' }));
        var day = et.getDay();
        var cur = et.getHours() * 60 + et.getMinutes() + et.getSeconds() / 60;
        var todayBounds = PAUSE_BOUNDS[day] || [];
        for (var i = 0; i < todayBounds.length; i++) {
            if (todayBounds[i] > cur) {
                return etMidnightUTC(et.getFullYear(), et.getMonth(), et.getDate()) + todayBounds[i] * 60000;
            }
        }
        for (var ahead = 1; ahead <= 7; ahead++) {
            var nextMid = etMidnightUTC(et.getFullYear(), et.getMonth(), et.getDate() + ahead);
            var nextET = new Date(new Date(nextMid).toLocaleString('en-US', { timeZone: 'America/Toronto' }));
            var nextDay = nextET.getDay();
            var nextBounds = PAUSE_BOUNDS[nextDay] || [];
            if (nextBounds.length > 0) return nextMid + nextBounds[0] * 60000;
        }
        return ms + 7 * 24 * 3600000;
    }

    function calcWorkingSeconds(startMs, endMs) {
        if (endMs <= startMs) return 0;
        var working = 0;
        var t = startMs;
        while (t < endMs) {
            var paused = isInPauseET(t);
            var next = getNextTransitionET(t);
            var seg = Math.min(next, endMs);
            if (!paused) working += seg - t;
            t = seg;
        }
        return Math.round(working / 1000);
    }
    // ============================================

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
    // ---- Custom Date Picker ----

    var datepickerState = { year: 2026, month: 2, selectedDate: null };
    var MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    var WEEKDAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

    function initDatepicker() {
        var input = document.getElementById('emp-hire-date');
        var trigger = document.getElementById('emp-hire-date-trigger');
        var picker = document.getElementById('emp-hire-date-picker');
        if (!input || !trigger || !picker) return;

        function toggle() {
            if (picker.classList.contains('active')) {
                picker.classList.remove('active');
                return;
            }
            // Parse existing value
            var val = input.value;
            if (val && /^\d{2}-\d{2}-\d{4}$/.test(val)) {
                var parts = val.split('-');
                datepickerState.year = parseInt(parts[2]);
                datepickerState.month = parseInt(parts[1]) - 1;
                datepickerState.selectedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
                var now = new Date();
                datepickerState.year = now.getFullYear();
                datepickerState.month = now.getMonth();
                datepickerState.selectedDate = null;
            }
            renderDatepicker();
            picker.classList.add('active');
        }

        input.addEventListener('click', toggle);
        trigger.addEventListener('click', function(e) { e.preventDefault(); toggle(); });

        // Close on click outside
        document.addEventListener('click', function(e) {
            if (!picker.contains(e.target) && e.target !== input && e.target !== trigger && !trigger.contains(e.target)) {
                picker.classList.remove('active');
            }
        });
    }

    function renderDatepicker() {
        var picker = document.getElementById('emp-hire-date-picker');
        if (!picker) return;

        var year = datepickerState.year;
        var month = datepickerState.month;
        var today = new Date();
        today.setHours(0,0,0,0);

        var firstDay = new Date(year, month, 1);
        var lastDay = new Date(year, month + 1, 0);
        var startWeekday = (firstDay.getDay() + 6) % 7; // Monday=0

        var html = '<div class="datepicker-header">';
        html += '<button type="button" onclick="window._dpPrev(event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>';
        html += '<span class="datepicker-month-year">' + MONTHS_FR[month] + ' ' + year + '</span>';
        html += '<button type="button" onclick="window._dpNext(event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>';
        html += '</div>';

        html += '<div class="datepicker-weekdays">';
        WEEKDAYS_FR.forEach(function(d) { html += '<span>' + d + '</span>'; });
        html += '</div>';

        html += '<div class="datepicker-days">';

        // Previous month days
        var prevMonthLast = new Date(year, month, 0).getDate();
        for (var p = startWeekday - 1; p >= 0; p--) {
            var pd = prevMonthLast - p;
            html += '<button type="button" class="datepicker-day other-month" data-date="' + (month === 0 ? year-1 : year) + '-' + (month === 0 ? 12 : month) + '-' + pd + '">' + pd + '</button>';
        }

        // Current month days
        for (var d = 1; d <= lastDay.getDate(); d++) {
            var dateObj = new Date(year, month, d);
            var classes = 'datepicker-day';
            if (dateObj.getTime() === today.getTime()) classes += ' today';
            if (datepickerState.selectedDate && dateObj.getTime() === datepickerState.selectedDate.getTime()) classes += ' selected';
            html += '<button type="button" class="' + classes + '" data-date="' + year + '-' + (month + 1) + '-' + d + '">' + d + '</button>';
        }

        // Next month days
        var totalCells = startWeekday + lastDay.getDate();
        var remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (var n = 1; n <= remaining; n++) {
            html += '<button type="button" class="datepicker-day other-month" data-date="' + (month === 11 ? year+1 : year) + '-' + (month === 11 ? 1 : month+2) + '-' + n + '">' + n + '</button>';
        }

        html += '</div>';
        html += '<button type="button" class="datepicker-today-btn" onclick="window._dpToday(event)">Aujourd\'hui</button>';

        picker.innerHTML = html;

        // Attach click handlers to day buttons
        picker.querySelectorAll('.datepicker-day').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var parts = btn.getAttribute('data-date').split('-');
                var selDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                datepickerState.selectedDate = selDate;
                datepickerState.year = selDate.getFullYear();
                datepickerState.month = selDate.getMonth();
                var input = document.getElementById('emp-hire-date');
                input.value = String(selDate.getDate()).padStart(2, '0') + '-' + String(selDate.getMonth() + 1).padStart(2, '0') + '-' + selDate.getFullYear();
                picker.classList.remove('active');
                // Clear validation error if present
                if (input.classList.contains('field-error')) {
                    input.classList.remove('field-error');
                }
            });
        });
    }

    // Global nav functions for datepicker
    window._dpPrev = function(e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        datepickerState.month--;
        if (datepickerState.month < 0) { datepickerState.month = 11; datepickerState.year--; }
        renderDatepicker();
    };
    window._dpNext = function(e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        datepickerState.month++;
        if (datepickerState.month > 11) { datepickerState.month = 0; datepickerState.year++; }
        renderDatepicker();
    };
    window._dpToday = function(e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        var today = new Date();
        datepickerState.year = today.getFullYear();
        datepickerState.month = today.getMonth();
        datepickerState.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        var input = document.getElementById('emp-hire-date');
        input.value = String(today.getDate()).padStart(2, '0') + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + today.getFullYear();
        document.getElementById('emp-hire-date-picker').classList.remove('active');
        if (input.classList.contains('field-error')) input.classList.remove('field-error');
    };

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

    function initControl() {
        // Check if URL has ?view=scanner - auto-open scanner
        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('view') === 'scanner') {
            loadEmployees();
            loadVehicles();
            setTimeout(function() { openScanner(); }, 300);
            window.history.replaceState({}, '', window.location.pathname);
        } else {
            // Restore saved subtab
            var savedSubtab = sessionStorage.getItem('control-subtab');
            if (savedSubtab) {
                var btn = document.querySelector('.control-subtab[data-subtab="' + savedSubtab + '"]');
                if (btn) btn.click();
            } else {
                loadEmployees();
            }
        }
        startNotifPolling();
    }

    // ---- SUB-TAB SWITCHING ----

    function initSubtabs() {
        document.querySelectorAll('.control-subtab').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.control-subtab').forEach(function(b) { b.classList.remove('active'); });
                document.querySelectorAll('.control-panel').forEach(function(p) { p.classList.remove('active'); });
                btn.classList.add('active');
                var target = btn.getAttribute('data-subtab');
                sessionStorage.setItem('control-subtab', target);
                if (target === 'employees') {
                    document.getElementById('panel-employees').classList.add('active');
                    loadEmployees();
                } else if (target === 'vehicles') {
                    document.getElementById('panel-vehicles').classList.add('active');
                    loadVehicles();
                } else if (target === 'monitoring') {
                    document.getElementById('panel-monitoring').classList.add('active');
                    loadMonitoring();
                } else if (target === 'medias') {
                    document.getElementById('panel-medias').classList.add('active');
                    loadMedias();
                    clearInterval(mediaPollingInterval);
                    mediaPollingInterval = setInterval(function() {
                        var panel = document.getElementById('panel-medias');
                        if (panel && panel.classList.contains('active') && !mediaClassifyMode && !mediaDeleteMode) {
                            loadMedias();
                        } else if (!panel || !panel.classList.contains('active')) {
                            clearInterval(mediaPollingInterval);
                            mediaPollingInterval = null;
                        }
                    }, 10000);
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
            html += '<td><div class="col-actions col-actions--icons">';
            html += '<button class="icon-btn" title="Stats" onclick="Control.openEmployeeStats(\'' + emp.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></button>';
            html += '<button class="icon-btn" title="Modifier" onclick="Control.editEmployee(\'' + emp.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
            html += '<button class="icon-btn icon-btn--danger" title="Supprimer" onclick="Control.deleteEmployee(\'' + emp.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>';
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
            showToast('error', 'Erreur', e.message);
        }
    }

    async function editEmployee(id) {
        try {
            var emp = await api('GET', '/api/control-employees?id=' + id);
            openEmployeeModal(emp);
        } catch(e) {
            showToast('error', 'Erreur', e.message);
        }
    }

    function deleteEmployee(id) {
        showConfirmDelete('Supprimer cet employé ?', 'L\'employé et tout son historique seront supprimés.', async function() {
            try {
                await api('DELETE', '/api/control-employees?id=' + id);
                loadEmployees();
            } catch(e) { showToast('error', 'Erreur', e.message); }
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
            showToast('error', 'Erreur', e.message);
        }
    }

    var empStatsOrders = [];
    var empStatsPage = 0;
    var HISTORY_PAGE_SIZE = 10;

    async function loadEmployeeStats(period) {
        if (!currentEmpStatsId) return;
        empStatsPage = 0;
        try {
            var data = await api('GET', '/api/control-employees?stats=true&id=' + currentEmpStatsId + '&period=' + period);
            var stats = data.stats;

            document.getElementById('emp-stat-hours').textContent = formatDuration(stats.total_seconds);
            document.getElementById('emp-stat-vehicles').textContent = stats.vehicle_count;
            document.getElementById('emp-stat-avg').textContent = formatDuration(stats.avg_seconds_per_vehicle);

            empStatsOrders = data.orders || [];
            renderEmpStatsHistory();
        } catch(e) {
            document.getElementById('emp-stats-history').innerHTML = '<p style="color:var(--danger);">Erreur: ' + escHtml(e.message) + '</p>';
        }
    }

    function renderEmpStatsHistory() {
        var historyEl = document.getElementById('emp-stats-history');
        if (empStatsOrders.length === 0) {
            historyEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;">Aucun bon de travail pour cette période.</p>';
            return;
        }
        var totalPages = Math.ceil(empStatsOrders.length / HISTORY_PAGE_SIZE);
        var page = Math.min(empStatsPage, totalPages - 1);
        var start = page * HISTORY_PAGE_SIZE;
        var pageData = empStatsOrders.slice(start, start + HISTORY_PAGE_SIZE);

        var html = '<table class="control-table"><thead><tr><th>Date</th><th>Véhicule</th><th>Durée</th></tr></thead><tbody>';
        pageData.forEach(function(o) {
            var vehName = o.vehicle ? (o.vehicle.make + (o.vehicle.plate ? ' - ' + o.vehicle.plate : '')) : 'Inconnu';
            html += '<tr><td>' + formatDateTime(o.started_at) + '</td><td>' + escHtml(vehName) + '</td><td>' + formatDuration(o.duration_seconds) + '</td></tr>';
        });
        html += '</tbody></table>';
        if (totalPages > 1) {
            html += renderPagination(page, totalPages, 'Control.empStatsGoTo');
        }
        historyEl.innerHTML = html;
    }

    function empStatsGoTo(p) { empStatsPage = p; renderEmpStatsHistory(); }

    var vehDetailOrders = [];
    var vehDetailPage = 0;

    function renderVehDetailHistory() {
        var el = document.getElementById('veh-detail-history');
        if (!el) return;
        if (vehDetailOrders.length === 0) {
            el.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;">Aucun historique.</p>';
            return;
        }
        var totalPages = Math.ceil(vehDetailOrders.length / HISTORY_PAGE_SIZE);
        var page = Math.min(vehDetailPage, totalPages - 1);
        var start = page * HISTORY_PAGE_SIZE;
        var pageData = vehDetailOrders.slice(start, start + HISTORY_PAGE_SIZE);

        var html = '<table class="control-table"><thead><tr><th>Date</th><th>Employé</th><th>Durée</th></tr></thead><tbody>';
        pageData.forEach(function(o) {
            var empName = o.employee ? (o.employee.first_name + ' ' + o.employee.last_name) : 'Inconnu';
            html += '<tr><td>' + formatDateTime(o.started_at) + '</td><td>' + escHtml(empName) + '</td><td>' + formatDuration(o.duration_seconds) + '</td></tr>';
        });
        html += '</tbody></table>';
        if (totalPages > 1) {
            html += renderPagination(page, totalPages, 'Control.vehDetailGoTo');
        }
        el.innerHTML = html;
    }

    function vehDetailGoTo(p) { vehDetailPage = p; renderVehDetailHistory(); }

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

    function sortVehicles(list) {
        return list.slice().sort(function(a, b) {
            var aActive = a.active_order ? 2 : 0;
            var bActive = b.active_order ? 2 : 0;
            var aNfc = a.nfc_tag_id ? 1 : 0;
            var bNfc = b.nfc_tag_id ? 1 : 0;
            return (bActive + bNfc) - (aActive + aNfc);
        });
    }

    function filterVehicles() {
        var q = vehSearchQuery.toLowerCase().trim();
        var list = q ? allVehicles.filter(function(v) {
            return (v.make || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.model || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.owner_name || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.phone || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.email || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.plate || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.vin || '').toLowerCase().indexOf(q) !== -1 ||
                   (v.reference || '').toLowerCase().indexOf(q) !== -1;
        }) : allVehicles;
        return sortVehicles(list);
    }

    function renderVehicles() {
        var container = document.getElementById('vehicles-list');
        clearAllTimers();
        var filtered = filterVehicles();

        // Search bar
        var html = '<div class="control-search"><input type="text" id="veh-search-input" placeholder="Rechercher par véhicule, propriétaire, téléphone, courriel, plaque, NIV, référence..." value="' + escHtml(vehSearchQuery) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>';

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

        html += '<table class="control-table"><thead><tr><th>Véhicule</th><th>Badge NFC</th><th>Statut</th><th style="text-align:right;">Actions</th></tr></thead><tbody>';
        pageData.forEach(function(v) {
            var nfcBadge = v.nfc_tag_id
                ? '<span class="nfc-badge nfc-badge--assigned">Assigné</span>'
                : '<span class="nfc-badge nfc-badge--unassigned">Non assigné</span>';

            var statusHtml = '';
            var subLine = escHtml(v.owner_name);
            if (v.active_order) {
                var paused = !!v.active_order.paused;
                var timerId = 'live-veh-' + v.id;
                var aoEmp = v.active_order.employee;
                var aoEmpName = aoEmp ? (aoEmp.first_name + ' ' + aoEmp.last_name) : '';
                var dotClass = 'live-dot' + (paused ? ' live-dot--paused' : '');
                statusHtml = '<span class="live-indicator"><span class="' + dotClass + '"></span><span class="live-timer" id="' + timerId + '">...</span></span>';
                if (aoEmpName) {
                    var empColor = paused ? '#f59e0b' : '#22c55e';
                    subLine += ' - <span style="color:' + empColor + ';">' + escHtml(aoEmpName) + '</span>';
                }
                setTimeout(function() { startLiveTimer(timerId, v.active_order.started_at, paused); }, 50);
            } else {
                statusHtml = '<span style="color:var(--text-muted);font-size:0.85rem;">-</span>';
            }

            var vehLabel = escHtml(v.make) + (v.model ? ' ' + escHtml(v.model) : '') + (v.year ? ' - ' + v.year : '');

            html += '<tr>';
            html += '<td class="col-name clickable-row" onclick="Control.openVehicleDetail(\'' + v.id + '\')">' + vehLabel + '<div style="font-size:0.82rem;font-weight:400;color:var(--text-muted);margin-top:2px;">' + subLine + '</div></td>';
            html += '<td>' + nfcBadge + '</td>';
            html += '<td>' + statusHtml + '</td>';
            html += '<td><div class="col-actions col-actions--icons">';
            if (v.active_order) {
                html += '<button class="icon-btn icon-btn--stop" title="Arrêter le bon de travail" onclick="Control.stopWorkOrder(\'' + v.id + '\',\'' + escHtml(vehLabel) + '\')"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1"/></svg></button>';
            }
            html += '<button class="icon-btn" title="Détail" onclick="Control.openVehicleDetail(\'' + v.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>';
            html += '<button class="icon-btn" title="Modifier" onclick="Control.editVehicle(\'' + v.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
            html += '<button class="icon-btn icon-btn--danger" title="Supprimer" onclick="Control.deleteVehicle(\'' + v.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>';
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

    function startLiveTimer(elementId, startedAt, paused) {
        var el = document.getElementById(elementId);
        if (!el) return;
        var start = new Date(startedAt).getTime();
        if (start > Date.now()) start = Date.now();
        function update() {
            var now = Date.now();
            var working = calcWorkingSeconds(start, now);
            if (el) {
                el.textContent = formatDurationLong(working);
                el.style.color = paused ? '#f59e0b' : '';
            }
        }
        update();
        liveTimers[elementId] = setInterval(update, 1000);
    }

    function openVehicleModal(veh) {
        document.getElementById('vehicle-modal-title').textContent = veh ? 'Modifier le véhicule' : 'Nouveau véhicule';
        document.getElementById('veh-edit-id').value = veh ? veh.id : '';
        document.getElementById('veh-owner').value = veh ? veh.owner_name : '';
        document.getElementById('veh-phone').value = veh ? (veh.phone || '') : '';
        document.getElementById('veh-email').value = veh ? (veh.email || '') : '';
        document.getElementById('veh-reference').value = veh ? (veh.reference || '') : '';
        document.getElementById('veh-make').value = veh ? veh.make : '';
        document.getElementById('veh-model').value = veh ? (veh.model || '') : '';
        document.getElementById('veh-year').value = veh ? (veh.year || '') : '';
        document.getElementById('veh-color').value = veh ? (veh.color || '') : '';
        document.getElementById('veh-plate').value = veh ? (veh.plate || '') : '';
        document.getElementById('veh-vin').value = veh ? (veh.vin || '') : '';
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
            email: document.getElementById('veh-email').value.trim(),
            reference: document.getElementById('veh-reference').value.trim(),
            make: document.getElementById('veh-make').value.trim(),
            model: document.getElementById('veh-model').value.trim(),
            year: document.getElementById('veh-year').value.trim(),
            color: document.getElementById('veh-color').value.trim(),
            plate: document.getElementById('veh-plate').value.trim(),
            vin: document.getElementById('veh-vin').value.trim(),
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
                showToast('error', 'Erreur upload', e.message);
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
            showToast('error', 'Erreur', e.message);
        }
    }

    async function editVehicle(id) {
        try {
            var res = await api('GET', '/api/control-vehicles?id=' + id);
            openVehicleModal(res.vehicle);
        } catch(e) {
            showToast('error', 'Erreur', e.message);
        }
    }

    function deleteVehicle(id) {
        showConfirmDelete('Supprimer ce véhicule ?', 'Le véhicule et tout son historique seront supprimés.', async function() {
            try {
                await api('DELETE', '/api/control-vehicles?id=' + id);
                loadVehicles();
            } catch(e) { showToast('error', 'Erreur', e.message); }
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

            document.getElementById('veh-detail-title').textContent = v.make + (v.model ? ' ' + v.model : '') + (v.year ? ' ' + v.year : '') + (v.plate ? ' - ' + v.plate : '');

            var html = '';

            // Header with photo + info
            html += '<div class="veh-detail-header">';
            if (v.photo_url) {
                html += '<img src="' + escHtml(v.photo_url) + '" alt="Photo">';
            }
            html += '<div class="veh-detail-info">';
            html += '<h3>' + escHtml(v.make) + (v.model ? ' ' + escHtml(v.model) : '') + (v.year ? ' ' + v.year : '') + '</h3>';
            html += '<p><strong>Propriétaire:</strong> ' + escHtml(v.owner_name) + '</p>';
            if (v.phone) html += '<p><strong>Tél:</strong> ' + escHtml(v.phone) + '</p>';
            if (v.email) html += '<p><strong>Courriel:</strong> ' + escHtml(v.email) + '</p>';
            if (v.plate) html += '<p><strong>Plaque:</strong> ' + escHtml(v.plate) + '</p>';
            if (v.color) html += '<p><strong>Couleur:</strong> ' + escHtml(v.color) + '</p>';
            if (v.vin) html += '<p><strong>VIN:</strong> ' + escHtml(v.vin) + '</p>';
            if (v.reference) html += '<p><strong>Référence:</strong> ' + escHtml(v.reference) + '</p>';
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
            vehDetailOrders = data.orders.filter(function(o) { return o.ended_at; });
            vehDetailPage = 0;
            html += '<div id="veh-detail-history"></div>';

            // Médias
            html += '<h3 style="font-size:0.95rem;margin-bottom:12px;margin-top:24px;">Médias</h3>';
            html += '<div id="veh-media-section" style="min-height:40px;"><p style="color:var(--text-muted);font-size:0.85rem;">Chargement...</p></div>';

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
            renderVehDetailHistory();
            document.getElementById('vehicle-detail-modal').classList.add('active');
            loadVehicleMedias(id);

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
            showToast('error', 'Erreur', e.message);
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
        } catch(e) { showToast('error', 'Erreur', e.message); }
    }

    async function deleteVehicleNote(noteId) {
        try {
            await api('DELETE', '/api/control-vehicle-notes?id=' + noteId);
            openVehicleDetail(currentVehDetailId);
        } catch(e) { showToast('error', 'Erreur', e.message); }
    }

    // ---- CONFIRM DELETE ----

    function showConfirmDelete(title, msg, callback, btnLabel) {
        document.getElementById('control-confirm-title').textContent = title;
        document.getElementById('control-confirm-msg').textContent = msg;
        document.getElementById('control-confirm-delete').textContent = btnLabel || 'Supprimer';
        deleteCallback = callback;
        document.getElementById('control-confirm-modal').classList.add('active');
    }

    // ---- NFC WEBSOCKET CONNECTION ----

    var nfcWs = null;
    var nfcWsConnected = false;
    var nfcReaderReady = false;

    function updateNfcStatusPanel() {
        var panel = document.getElementById('nfc-status-panel');
        var dot = document.getElementById('nfc-status-dot');
        var icon = document.getElementById('nfc-status-icon');
        var pulse = document.getElementById('nfc-status-pulse');
        var bg = document.getElementById('nfc-status-bg');
        var label = document.getElementById('nfc-status-label');
        var detail = document.getElementById('nfc-status-detail');
        if (!panel) return;
        if (nfcWsConnected && nfcReaderReady) {
            var c = '#22c55e';
            panel.style.borderColor = c + '40';
            panel.style.background = c + '0a';
            dot.style.background = c + '20';
            dot.style.color = c;
            icon.innerHTML = '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
            pulse.style.borderColor = c;
            pulse.style.animation = 'nfc-pulse 2s ease-out infinite';
            bg.style.background = 'radial-gradient(circle at 30% 50%,' + c + ',' + c + '00)';
            label.textContent = 'Lecteur NFC connecté';
            label.style.color = c;
            detail.textContent = 'Le lecteur est prêt à scanner.';
        } else if (nfcWsConnected && !nfcReaderReady) {
            var c = '#f59e0b';
            panel.style.borderColor = c + '40';
            panel.style.background = c + '0a';
            dot.style.background = c + '20';
            dot.style.color = c;
            icon.innerHTML = '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
            pulse.style.borderColor = c;
            pulse.style.animation = 'nfc-pulse 1.5s ease-out infinite';
            bg.style.background = 'radial-gradient(circle at 30% 50%,' + c + ',' + c + '00)';
            label.textContent = 'Lecteur USB non détecté';
            label.style.color = c;
            detail.textContent = 'Le serveur fonctionne mais aucun lecteur n\'est branché.';
        } else {
            var c = '#ef4444';
            panel.style.borderColor = c + '30';
            panel.style.background = c + '08';
            dot.style.background = c + '20';
            dot.style.color = c;
            icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
            pulse.style.borderColor = c;
            pulse.style.animation = 'none';
            pulse.style.opacity = '0';
            bg.style.background = 'radial-gradient(circle at 30% 50%,' + c + ',' + c + '00)';
            label.textContent = 'Serveur NFC déconnecté';
            label.style.color = c;
            detail.textContent = 'Lancez NFC-Reader.exe pour connecter le lecteur.';
        }
    }

    function connectNfcWebSocket() {
        if (nfcWs && nfcWs.readyState <= 1) return;
        try {
            nfcWs = new WebSocket('ws://localhost:6868');
            nfcWs.onopen = function() {
                nfcWsConnected = true;
                console.log('[NFC] WebSocket connecté');
                updateNfcStatusPanel();
            };
            nfcWs.onmessage = function(event) {
                var data = JSON.parse(event.data);
                if (data.type === 'status') {
                    nfcReaderReady = data.reader;
                    console.log('[NFC] Lecteur ' + (data.reader ? 'connecté' : 'déconnecté'));
                    updateNfcStatusPanel();
                } else if (data.type === 'nfc_tag') {
                    console.log('[NFC] Tag scanné: ' + data.uid);
                    // If assigning a badge
                    if (nfcAssignCallback) {
                        var cb = nfcAssignCallback;
                        nfcAssignCallback = null;
                        hideNfcScanModal();
                        cb(data.uid);
                        return;
                    }
                    // If scanner is open
                    if (scannerState) {
                        handleNfcScan(data.uid);
                    }
                }
            };
            nfcWs.onclose = function() {
                nfcWsConnected = false;
                nfcReaderReady = false;
                console.log('[NFC] WebSocket déconnecté, reconnexion dans 3s...');
                updateNfcStatusPanel();
                setTimeout(connectNfcWebSocket, 3000);
            };
            nfcWs.onerror = function() {
                nfcWs.close();
            };
        } catch(e) {
            console.warn('[NFC] WebSocket error:', e);
            setTimeout(connectNfcWebSocket, 3000);
        }
    }

    function showNfcScanModal() {
        var modal = document.getElementById('nfc-scan-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'nfc-scan-modal';
            modal.className = 'modal-overlay active';
            modal.innerHTML = '<div class="modal" style="text-align:center;padding:40px;max-width:400px;"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="width:64px;height:64px;margin-bottom:16px;animation:pulse 1.5s infinite;"><rect x="2" y="2" width="20" height="20" rx="4"/><path d="M8 7v10M12 5v14M16 7v10"/></svg><h3 style="margin-bottom:8px;">Scannez le badge NFC</h3><p style="color:var(--muted);margin-bottom:24px;">Approchez la carte du lecteur...</p><button class="btn" onclick="document.getElementById(\'nfc-scan-modal\').remove();window._controlModule.cancelNfcAssign();">Annuler</button></div>';
            document.body.appendChild(modal);
        } else {
            modal.classList.add('active');
        }
    }

    function hideNfcScanModal() {
        var modal = document.getElementById('nfc-scan-modal');
        if (modal) modal.remove();
    }

    // ---- NFC ASSIGNMENT ----

    async function checkNfcConflict(tagId, type, currentId) {
        try {
            // Check employees
            var emps = allEmployees.filter(function(e) { return e.nfc_tag_id === tagId; });
            for (var i = 0; i < emps.length; i++) {
                if (type === 'employee' && currentId && emps[i].id === currentId) continue;
                return 'Ce badge est déjà assigné à l\'employé ' + emps[i].first_name + ' ' + emps[i].last_name + '.';
            }
            // Check vehicles
            var vehs = allVehicles.filter(function(v) { return v.nfc_tag_id === tagId; });
            for (var j = 0; j < vehs.length; j++) {
                if (type === 'vehicle' && currentId && vehs[j].id === currentId) continue;
                return 'Ce badge est déjà assigné au véhicule ' + vehs[j].make + (vehs[j].year ? ' ' + vehs[j].year : '') + (vehs[j].plate ? ' (' + vehs[j].plate + ')' : '') + '.';
            }
            return null;
        } catch(e) {
            return null;
        }
    }

    function assignNfc(callback) {
        if (nfcWsConnected && nfcReaderReady) {
            nfcAssignCallback = callback;
            showNfcScanModal();
        } else if (nfcWsConnected && !nfcReaderReady) {
            showToast('warning', 'Lecteur NFC non détecté', 'Vérifiez la connexion USB.');
        } else {
            var tagId = prompt('Serveur NFC non connecté.\nEntrez manuellement l\'identifiant du badge:');
            if (tagId) callback(tagId.toUpperCase());
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
        stopDashboardOrderTimers();
    }

    function setScannerState(state) {
        clearScannerTimers();
        scannerState = state;
        var content = document.getElementById('scanner-content');

        if (state === 'WAITING_VEHICLE') {
            scannerVehicle = null;
            scannerActiveOrder = null;
            stopDashboardOrderTimers();
            content.innerHTML = '<div class="nfc-scanner__title">VÉHICULE</div>' + SCANNER_NFC_ICON + '<div class="nfc-scanner__subtitle">Scannez la carte NFC du véhicule</div>' + getScannerSimHtml() + '<div class="nfc-scanner__orders" id="dashboard-orders"><div class="nfc-scanner__orders-title">Bons de travail en cours</div><div id="dashboard-orders-list" class="nfc-scanner__orders-grid"><div class="nfc-scanner__orders-empty">Chargement...</div></div></div>';
            loadDashboardOrders();

        } else if (state === 'WAITING_EMPLOYEE') {
            var v = scannerVehicle;
            content.innerHTML = '<div class="nfc-scanner__info"><p><strong>' + escHtml(v.make) + (v.year ? ' ' + v.year : '') + '</strong></p>' + (v.plate ? '<p>Plaque: ' + escHtml(v.plate) + '</p>' : '') + '<p>Propriétaire: ' + escHtml(v.owner_name) + '</p></div><div class="nfc-scanner__title" style="margin-top:32px;">EMPLOYÉ</div>' + SCANNER_NFC_ICON + '<div class="nfc-scanner__subtitle">Scannez le badge de l\'employé</div>' + getScannerSimHtml();

        } else if (state === 'CLOSING_ORDER') {
            var v2 = scannerVehicle;
            var ao = scannerActiveOrder;
            var empName = ao.employee ? (ao.employee.first_name + ' ' + ao.employee.last_name) : 'Inconnu';
            content.innerHTML = '<div class="nfc-scanner__info"><p><strong>' + escHtml(v2.make) + (v2.year ? ' ' + v2.year : '') + '</strong></p>' + (v2.plate ? '<p>Plaque: ' + escHtml(v2.plate) + '</p>' : '') + '<p>Propriétaire: ' + escHtml(v2.owner_name) + '</p><p style="margin-top:8px;">Employé: <strong>' + escHtml(empName) + '</strong></p></div><div class="nfc-scanner__elapsed" id="scanner-elapsed">00:00:00</div><div class="nfc-scanner__title" style="font-size:4rem;margin-top:20px;">EMPLOYÉ</div>' + SCANNER_NFC_ICON + '<div class="nfc-scanner__subtitle">Scannez le badge pour fermer le bon de travail</div>' + getScannerSimHtml();
            setTimeout(function() { startScannerTimer(ao.started_at, !!ao.paused); }, 50);

        } else if (state === 'SUCCESS_OPEN') {
            stopDashboardOrderTimers();
            content.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:80px;height:80px;color:var(--success);margin-bottom:20px;"><path d="M20 6L9 17l-5-5"/></svg><div class="nfc-scanner__success">Bon de travail commencé</div><div class="nfc-scanner__countdown" id="scanner-countdown">Retour dans 5 secondes...</div>';
            var countdown = 5;
            scannerInterval = setInterval(function() {
                countdown--;
                var el = document.getElementById('scanner-countdown');
                if (el) el.textContent = 'Retour dans ' + countdown + ' secondes...';
                if (countdown <= 0) setScannerState('WAITING_VEHICLE');
            }, 1000);

        } else if (state === 'SUCCESS_CLOSE') {
            stopDashboardOrderTimers();
            content.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:80px;height:80px;color:var(--success);margin-bottom:20px;"><path d="M20 6L9 17l-5-5"/></svg><div class="nfc-scanner__success">Bon de travail terminé</div><div class="nfc-scanner__countdown" id="scanner-countdown">Retour dans 5 secondes...</div>';
            var countdown2 = 5;
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

    function stopDashboardOrderTimers() {
        dashboardOrderTimers.forEach(function(t) { clearInterval(t); });
        dashboardOrderTimers = [];
        if (dashboardOrdersInterval) { clearInterval(dashboardOrdersInterval); dashboardOrdersInterval = null; }
    }

    async function loadDashboardOrders() {
        try {
            var orders = await api('GET', '/api/control-work-orders?active=true');
            renderDashboardOrders(orders || []);
            // Refresh every 30s
            if (!dashboardOrdersInterval) {
                dashboardOrdersInterval = setInterval(function() { loadDashboardOrders(); }, 30000);
            }
        } catch(e) {
            var list = document.getElementById('dashboard-orders-list');
            if (list) list.innerHTML = '<div class="nfc-scanner__orders-empty">Impossible de charger les bons de travail</div>';
        }
    }

    function renderDashboardOrders(orders) {
        var list = document.getElementById('dashboard-orders-list');
        if (!list) return;

        // Clear old timers
        dashboardOrderTimers.forEach(function(t) { clearInterval(t); });
        dashboardOrderTimers = [];

        if (!orders || orders.length === 0) {
            list.innerHTML = '<div class="nfc-scanner__orders-empty">Aucun bon de travail en cours</div>';
            return;
        }

        var html = '';
        orders.forEach(function(order, i) {
            var v = order.vehicle || {};
            var e = order.employee || {};
            var vehicleName = escHtml(v.make || 'Véhicule') + (v.year ? ' ' + v.year : '');
            var plate = v.plate ? ' - ' + escHtml(v.plate) : '';
            var empName = escHtml((e.first_name || '') + ' ' + (e.last_name || ''));
            var ownerName = v.owner_name ? ' - ' + escHtml(v.owner_name) : '';

            html += '<div class="nfc-scanner__order-card">' +
                '<div class="nfc-scanner__order-dot"></div>' +
                '<div class="nfc-scanner__order-info">' +
                    '<div class="nfc-scanner__order-vehicle">' + vehicleName + plate + '</div>' +
                    '<div class="nfc-scanner__order-employee">' + empName + ownerName + '</div>' +
                '</div>' +
                '<div class="nfc-scanner__order-timer" id="dash-order-timer-' + i + '">00:00:00</div>' +
            '</div>';
        });

        list.innerHTML = html;

        // Start live timers
        orders.forEach(function(order, i) {
            var el = document.getElementById('dash-order-timer-' + i);
            if (!el) return;
            var card = el.closest('.nfc-scanner__order-card');
            var dot = card ? card.querySelector('.nfc-scanner__order-dot') : null;
            var start = new Date(order.started_at).getTime();
            if (start > Date.now()) start = Date.now();
            function updateTimer() {
                var now = Date.now();
                var paused = !!order.paused;
                var working = calcWorkingSeconds(start, now);
                var h = Math.floor(working / 3600);
                var m = Math.floor((working % 3600) / 60);
                var s = working % 60;
                el.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
                el.classList.toggle('nfc-scanner__order-timer--paused', paused);
                if (card) card.classList.toggle('nfc-scanner__order-card--paused', paused);
                if (dot) dot.classList.toggle('nfc-scanner__order-dot--paused', paused);
            }
            updateTimer();
            dashboardOrderTimers.push(setInterval(updateTimer, 1000));
        });
    }

    function getScannerSimHtml() {
        return '';
    }

    function startScannerTimer(startedAt, paused) {
        var el = document.getElementById('scanner-elapsed');
        if (!el) return;
        var start = new Date(startedAt).getTime();
        if (start > Date.now()) start = Date.now();
        function update() {
            var now = Date.now();
            var working = calcWorkingSeconds(start, now);
            if (el) {
                el.textContent = formatDurationLong(working);
                el.style.color = paused ? '#f59e0b' : '';
            }
        }
        update();
        scannerInterval = setInterval(update, 1000);
    }

    function startNfcListener() {
        // WebSocket handles NFC listening globally - nothing to do here
    }

    function stopNfcListener() {
        // WebSocket handles NFC listening globally - nothing to do here
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
                // Start work order - capture local time before API call
                var localStartTime = new Date().toISOString();
                await api('POST', '/api/control-work-orders', {
                    vehicle_id: scannerVehicle.id,
                    employee_id: employee.id,
                    started_at: localStartTime
                });
                setScannerState('SUCCESS_OPEN');
            } catch(e) {
                if (e.message && e.message.indexOf('already') !== -1) {
                    showScannerError('Ce véhicule a déjà un bon de travail en cours');
                } else {
                    showScannerError('Employé introuvable');
                }
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

    // ---- NOTIFICATIONS ----

    function addNotification(type, title, detail) {
        notifications.unshift({
            type: type, // 'start' or 'end'
            title: title,
            detail: detail,
            time: new Date()
        });
        if (notifications.length > 50) notifications.pop();
        updateNotifBadge();
        if (notifPanelOpen) renderNotifications();
    }

    function updateNotifBadge() {
        var badge = document.getElementById('notif-badge');
        var toggle = document.getElementById('notif-toggle');
        var count = notifications.length;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
            toggle.classList.add('has-new');
        } else {
            badge.style.display = 'none';
            toggle.classList.remove('has-new');
        }
    }

    function renderNotifications() {
        var list = document.getElementById('notif-list');
        if (!list) return;
        if (notifications.length === 0) {
            list.innerHTML = '<div class="control-notif-empty">Aucune notification</div>';
            return;
        }
        var html = '';
        notifications.forEach(function(n) {
            var iconClass = n.type === 'start' ? 'control-notif-item__icon--start' : 'control-notif-item__icon--end';
            var iconSvg = n.type === 'start'
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
            var timeAgo = formatTimeAgo(n.time);
            html += '<div class="control-notif-item">';
            html += '<div class="control-notif-item__icon ' + iconClass + '">' + iconSvg + '</div>';
            html += '<div class="control-notif-item__body"><div class="control-notif-item__title">' + escHtml(n.title) + '</div><div class="control-notif-item__detail">' + escHtml(n.detail) + '</div></div>';
            html += '<div class="control-notif-item__time">' + timeAgo + '</div>';
            html += '</div>';
        });
        list.innerHTML = html;
    }

    function formatTimeAgo(date) {
        var seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return 'À l\'instant';
        var minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes + ' min';
        var hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + 'h';
        return Math.floor(hours / 24) + 'j';
    }

    function toggleNotifPanel() {
        notifPanelOpen = !notifPanelOpen;
        var panel = document.getElementById('notif-panel');
        if (notifPanelOpen) {
            panel.style.display = 'block';
            renderNotifications();
        } else {
            panel.style.display = 'none';
        }
    }

    function clearNotifications() {
        notifications = [];
        updateNotifBadge();
        renderNotifications();
    }

    // Poll for work order changes
    async function pollWorkOrders() {
        try {
            var active = await api('GET', '/api/control-work-orders?active=true');
            if (!active) return;

            var currentIds = {};
            active.forEach(function(o) { currentIds[o.id] = o; });

            var hasChanges = false;

            // Detect new work orders (started)
            active.forEach(function(o) {
                if (!knownOrderIds[o.id]) {
                    fetchOrderNotif(o, 'start');
                    hasChanges = true;
                }
            });

            // Detect closed work orders (were known, now gone)
            Object.keys(knownOrderIds).forEach(function(id) {
                if (!currentIds[id]) {
                    fetchClosedOrderNotif(id);
                    hasChanges = true;
                }
            });

            knownOrderIds = currentIds;

            // Refresh vehicle list, dashboard and monitoring if changes detected
            if (hasChanges) {
                loadVehicles();
                loadDashboardOrders();
                var monPanel = document.getElementById('panel-monitoring');
                if (monPanel && monPanel.classList.contains('active')) loadMonitoring();
            }
        } catch(e) {}
    }

    function fetchOrderNotif(order) {
        var emp = order.employee;
        var veh = order.vehicle;
        var empName = emp ? (emp.first_name + ' ' + emp.last_name) : '?';
        var vehName = veh ? veh.make + (veh.plate ? ' - ' + veh.plate : '') : '?';
        addNotification('start', 'Bon de travail commencé', empName + ' → ' + vehName);
    }

    function fetchClosedOrderNotif(orderId) {
        var order = knownOrderIds[orderId];
        if (!order) return;
        var emp = order.employee;
        var veh = order.vehicle;
        var empName = emp ? (emp.first_name + ' ' + emp.last_name) : '?';
        var vehName = veh ? veh.make + (veh.plate ? ' - ' + veh.plate : '') : '?';
        var startMs = order.started_at ? new Date(order.started_at).getTime() : Date.now();
        if (startMs > Date.now()) startMs = Date.now();
        var duration = order.started_at ? formatDuration(Math.max(0, Math.floor((Date.now() - startMs) / 1000))) : '';
        addNotification('end', 'Bon de travail terminé', empName + ' → ' + vehName + (duration ? ' (' + duration + ')' : ''));
    }

    function startNotifPolling() {
        if (notifPollingInterval) return;
        // Initial load of known orders (no notification on first load)
        api('GET', '/api/control-work-orders?active=true').then(function(active) {
            if (active) active.forEach(function(o) { knownOrderIds[o.id] = o; });
        }).catch(function() {});
        // Poll every 10 seconds
        notifPollingInterval = setInterval(pollWorkOrders, 5000);
    }

    // ---- MEDIAS ----

    var SITE_ORIGIN = 'https://electrautoquebec.com';

    function mediaShareUrl(token) {
        return SITE_ORIGIN + '/media/' + token;
    }

    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function() {
                showToast('success', 'Lien copié', text, 2500);
            });
        } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('success', 'Lien copié', text, 2500);
        }
    }

    function renderMediaThumb(m, opts) {
        // opts: { selectable, removable }
        opts = opts || {};
        var isSelected = !!selectedMediaIds[m.id];
        var thumb = m.thumb_url || m.file_url;
        var isVideo = m.media_type === 'video';
        var cls = 'media-thumb' + (isSelected ? ' media-thumb--selected' : '');

        var inner = '';
        if (isVideo) {
            inner += '<img src="' + escHtml(thumb) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;">';
            inner += '<div class="media-thumb__video-icon"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg></div>';
        } else {
            inner += '<img src="' + escHtml(thumb) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;">';
        }

        // Checkmark overlay (classify mode)
        if (opts.selectable) {
            inner += '<div class="media-thumb__check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>';
        }

        // Action bar (share + optional remove)
        inner += '<div class="media-thumb__actions">';
        if (!opts.selectable) {
            inner += '<button class="media-thumb__btn" onclick="event.stopPropagation();Control.copyMediaLink(\'' + escHtml(m.share_token) + '\')" title="Copier le lien"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>';
        }
        if (opts.removable) {
            inner += '<button class="media-thumb__btn media-thumb__btn--remove" onclick="event.stopPropagation();Control.unassignMedia(\'' + escHtml(m.id) + '\')" title="Retirer du véhicule"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
        }
        inner += '</div>';

        var clickHandler = opts.selectable
            ? 'Control.toggleMediaSelect(\'' + escHtml(m.id) + '\')'
            : 'Control.openMediaFull(\'' + escHtml(m.file_url) + '\',\'' + escHtml(m.media_type) + '\')';

        return '<div class="' + cls + '" id="media-thumb-' + escHtml(m.id) + '" onclick="' + clickHandler + '">' + inner + '</div>';
    }

    async function loadMedias() {
        var gridNew = document.getElementById('media-grid-new');
        var groupsEl = document.getElementById('media-assigned-groups');
        if (!gridNew) return;
        gridNew.innerHTML = '<div class="media-empty-state">Chargement...</div>';
        if (groupsEl) groupsEl.innerHTML = '';
        try {
            var results = await Promise.all([
                api('GET', '/api/media?filter=unassigned'),
                api('GET', '/api/media?filter=assigned')
            ]);
            var unassigned = results[0] || [];
            var assigned = results[1] || [];

            // Badge counts
            var newBadge = document.getElementById('media-new-badge');
            var assignedBadge = document.getElementById('media-assigned-badge');
            if (newBadge) newBadge.textContent = unassigned.length || '';
            if (assignedBadge) assignedBadge.textContent = assigned.length || '';

            // Nouveau grid
            if (unassigned.length === 0) {
                gridNew.innerHTML = '<div class="media-empty-state">Aucun nouveau média.</div>';
            } else {
                gridNew.innerHTML = unassigned.map(function(m) {
                    return renderMediaThumb(m, { selectable: mediaClassifyMode || mediaDeleteMode });
                }).join('');
            }

            // Classé - group by vehicle
            if (!groupsEl) return;
            if (assigned.length === 0) {
                groupsEl.innerHTML = '<div class="media-empty-state">Aucun média classé.</div>';
                return;
            }
            // Group by vehicle_id
            var groups = {};
            var groupOrder = [];
            assigned.forEach(function(m) {
                var vid = m.vehicle_id;
                if (!groups[vid]) {
                    groups[vid] = { vehicle: m.vehicle, items: [] };
                    groupOrder.push(vid);
                }
                groups[vid].items.push(m);
            });
            var html = '';
            groupOrder.forEach(function(vid) {
                var g = groups[vid];
                var v = g.vehicle;
                var label = v ? (escHtml(v.make) + (v.model ? ' ' + escHtml(v.model) : '') + (v.year ? ' ' + v.year : '') + (v.plate ? ' - ' + escHtml(v.plate) : '')) : 'Véhicule inconnu';
                html += '<div class="media-group">';
                html += '<div class="media-group__title">' + label + ' <span class="media-badge">' + g.items.length + '</span></div>';
                html += '<div class="media-grid">' + g.items.map(function(m) { return renderMediaThumb(m, { selectable: mediaDeleteMode, removable: false }); }).join('') + '</div>';
                html += '</div>';
            });
            groupsEl.innerHTML = html;
        } catch(e) {
            gridNew.innerHTML = '<div class="media-empty-state">Erreur: ' + escHtml(e.message) + '</div>';
        }
    }

    function toggleMediaSelect(id) {
        if (!mediaClassifyMode && !mediaDeleteMode) return;
        var el = document.getElementById('media-thumb-' + id);
        if (!el) return;
        if (selectedMediaIds[id]) {
            delete selectedMediaIds[id];
            el.classList.remove('media-thumb--selected');
        } else {
            selectedMediaIds[id] = true;
            el.classList.add('media-thumb--selected');
        }
        var count = Object.keys(selectedMediaIds).length;
        var countEl = document.getElementById(mediaDeleteMode ? 'media-delete-count' : 'media-classify-count');
        if (countEl) countEl.textContent = count + ' sélectionné(s)';
    }

    function setMediaModeBtns(visible) {
        var wrap = document.getElementById('media-mode-btns');
        if (wrap) wrap.style.display = visible ? 'flex' : 'none';
    }

    function enterClassifyMode() {
        mediaClassifyMode = true;
        selectedMediaIds = {};
        setMediaModeBtns(false);
        var bar = document.getElementById('media-classify-bar');
        if (bar) bar.style.display = 'flex';
        var sel = document.getElementById('media-classify-vehicle');
        if (sel) {
            sel.innerHTML = '<option value="">Choisir un véhicule...</option>' +
                allVehicles.map(function(v) {
                    var label = escHtml(v.make) + (v.model ? ' ' + escHtml(v.model) : '') + (v.year ? ' ' + v.year : '') + (v.plate ? ' - ' + escHtml(v.plate) : '') + ' (' + escHtml(v.owner_name) + ')';
                    return '<option value="' + escHtml(v.id) + '">' + label + '</option>';
                }).join('');
        }
        loadMedias();
    }

    function exitClassifyMode() {
        mediaClassifyMode = false;
        selectedMediaIds = {};
        setMediaModeBtns(true);
        var bar = document.getElementById('media-classify-bar');
        if (bar) bar.style.display = 'none';
        loadMedias();
    }

    function enterDeleteMode() {
        mediaDeleteMode = true;
        selectedMediaIds = {};
        setMediaModeBtns(false);
        var bar = document.getElementById('media-delete-bar');
        if (bar) bar.style.display = 'flex';
        loadMedias();
    }

    function exitDeleteMode() {
        mediaDeleteMode = false;
        selectedMediaIds = {};
        setMediaModeBtns(true);
        var bar = document.getElementById('media-delete-bar');
        if (bar) bar.style.display = 'none';
        loadMedias();
    }

    async function deleteSelectedMedia() {
        var ids = Object.keys(selectedMediaIds);
        if (ids.length === 0) { showToast('warning', 'Aucune sélection', 'Sélectionnez au moins un média.'); return; }
        showConfirmDelete('Supprimer ' + ids.length + ' média(s) ?', 'Cette action est irréversible.', async function() {
            try {
                await Promise.all(ids.map(function(id) { return api('DELETE', '/api/media?id=' + id); }));
                showToast('success', 'Supprimé', ids.length + ' média(s) supprimé(s).');
                exitDeleteMode();
            } catch(e) {
                showToast('error', 'Erreur', e.message);
            }
        });
    }

    async function assignSelectedMedia() {
        var ids = Object.keys(selectedMediaIds);
        if (ids.length === 0) { showToast('warning', 'Aucune sélection', 'Sélectionnez au moins un média.'); return; }
        var vehicleId = document.getElementById('media-classify-vehicle').value;
        if (!vehicleId) { showToast('warning', 'Véhicule manquant', 'Choisissez un véhicule.'); return; }
        try {
            await api('PATCH', '/api/media?action=assign', { ids: ids, vehicle_id: vehicleId });
            showToast('success', 'Médias classés', ids.length + ' média(s) assigné(s).');
            exitClassifyMode();
        } catch(e) {
            showToast('error', 'Erreur', e.message);
        }
    }

    async function unassignMedia(id) {
        try {
            await api('PATCH', '/api/media?action=unassign&id=' + id, {});
            showToast('success', 'Média retiré', 'Retourné dans Nouveau.');
            // Refresh vehicle detail if open
            if (currentVehDetailId) openVehicleDetail(currentVehDetailId);
        } catch(e) {
            showToast('error', 'Erreur', e.message);
        }
    }

    function openMediaFull(fileUrl, mediaType) {
        // Simple lightbox - open in new tab for now
        window.open(fileUrl, '_blank');
    }

    async function loadVehicleMedias(vehicleId) {
        var section = document.getElementById('veh-media-section');
        if (!section) return;
        try {
            var items = await api('GET', '/api/media?vehicle_id=' + vehicleId);
            if (!items || items.length === 0) {
                section.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Aucun média.</p>';
                return;
            }
            section.innerHTML = '<div class="veh-media-grid">' +
                items.map(function(m) { return renderMediaThumb(m, { removable: true }); }).join('') +
                '</div>';
        } catch(e) {
            section.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Erreur chargement médias.</p>';
        }
    }

    // ---- MONITORING ----

    var monitoringTimers = [];
    var monitoringInterval = null;
    var mediaPollingInterval = null;
    var monitoringPauseOverrides = {};
    var lastPauseCheckTime = null;
    var lastPauseCheckDay = null;

    function checkPauseBoundaries(activeOrders) {
        var et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
        var day = et.getDay();
        var t = et.getHours() * 60 + et.getMinutes();

        if (lastPauseCheckTime === null || lastPauseCheckDay !== day) {
            lastPauseCheckTime = t;
            lastPauseCheckDay = day;
            return;
        }

        var bounds = PAUSE_BOUNDS[day] || [];
        var prev = lastPauseCheckTime;
        lastPauseCheckTime = t;
        lastPauseCheckDay = day;

        for (var i = 0; i < bounds.length; i++) {
            if (prev < bounds[i] && t >= bounds[i]) {
                if (i % 2 === 0) {
                    // Work starts → resume all paused orders
                    activeOrders.forEach(function(o) {
                        if (o.paused) {
                            monitoringPauseOverrides[o.id] = false;
                            api('PATCH', '/api/control-work-orders', { action: 'resume', id: o.id });
                        }
                    });
                } else {
                    // Work ends → pause all active orders
                    activeOrders.forEach(function(o) {
                        if (!o.paused) {
                            monitoringPauseOverrides[o.id] = true;
                            api('PATCH', '/api/control-work-orders', { action: 'pause', id: o.id });
                        }
                    });
                }
            }
        }
    }

    function toggleOrderPause(orderId, index) {
        var el = document.getElementById('monitoring-timer-' + index);
        var card = el ? el.closest('.monitoring-order') : null;
        var currentlyPaused = card && card.classList.contains('monitoring-order--paused');
        var newState = !currentlyPaused;
        monitoringPauseOverrides[orderId] = newState;
        var action = newState ? 'pause' : 'resume';
        api('PATCH', '/api/control-work-orders', { action: action, id: orderId });
    }

    function stopWorkOrder(vehicleId, vehName) {
        showConfirmDelete('Arrêter le bon de travail ?', 'Le chrono sera arrêté et le bon de travail pour ' + vehName + ' sera fermé.', async function() {
            try {
                await api('PATCH', '/api/control-work-orders', { vehicle_id: vehicleId });
                showToast('success', 'Bon fermé', 'Le bon de travail a été fermé.');
                loadMonitoring();
                loadVehicles();
            } catch(e) {
                showToast('error', 'Erreur', e.message);
            }
        }, 'Continuer');
    }

    async function loadMonitoring() {
        var statsEl = document.getElementById('monitoring-stats');
        var activeEl = document.getElementById('monitoring-active-orders');
        var recentEl = document.getElementById('monitoring-recent');
        if (!statsEl) return;

        try {
            // Load all data in parallel
            var results = await Promise.all([
                api('GET', '/api/control-employees'),
                api('GET', '/api/control-vehicles'),
                api('GET', '/api/control-work-orders?active=true'),
                api('GET', '/api/control-work-orders?recent=true'),
                api('GET', '/api/control-work-orders?stats=true')
            ]);

            var employees = results[0] || [];
            var vehicles = results[1] || [];
            var activeOrders = results[2] || [];
            var recentOrders = results[3] || [];
            var completionStats = results[4] || {};

            // Stats calculated server-side in America/Toronto - consistent across all clients
            var completedToday = completionStats.completed_today || 0;
            var completedWeek = completionStats.completed_week || 0;
            var completedMonth = completionStats.completed_month || 0;

            statsEl.innerHTML =
                '<div class="monitoring-card">' +
                    '<div class="monitoring-card__icon monitoring-card__icon--employees"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>' +
                    '<div><div class="monitoring-card__value">' + employees.length + '</div><div class="monitoring-card__label">Employés</div></div>' +
                '</div>' +
                '<div class="monitoring-card">' +
                    '<div class="monitoring-card__icon monitoring-card__icon--vehicles"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9"/></svg></div>' +
                    '<div><div class="monitoring-card__value">' + vehicles.length + '</div><div class="monitoring-card__label">Véhicules</div></div>' +
                '</div>' +
                '<div class="monitoring-card">' +
                    '<div class="monitoring-card__icon monitoring-card__icon--active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>' +
                    '<div><div class="monitoring-card__value">' + activeOrders.length + '</div><div class="monitoring-card__label">Bons en cours</div></div>' +
                '</div>' +
                '<div class="monitoring-card">' +
                    '<div class="monitoring-card__icon monitoring-card__icon--total"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>' +
                    '<div><div class="monitoring-card__value">' + completedToday + '</div><div class="monitoring-card__label">Complétés aujourd\'hui</div></div>' +
                '</div>' +
                '<div class="monitoring-card">' +
                    '<div class="monitoring-card__icon monitoring-card__icon--total"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>' +
                    '<div><div class="monitoring-card__value">' + completedWeek + '</div><div class="monitoring-card__label">Complétés cette semaine</div></div>' +
                '</div>' +
                '<div class="monitoring-card">' +
                    '<div class="monitoring-card__icon monitoring-card__icon--month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg></div>' +
                    '<div><div class="monitoring-card__value">' + completedMonth + '</div><div class="monitoring-card__label">Complétés ce mois-ci</div></div>' +
                '</div>';

            // Active work orders
            stopMonitoringTimers();
            if (activeOrders.length === 0) {
                activeEl.innerHTML = '<div class="monitoring-empty">Aucun bon de travail en cours</div>';
            } else {
                var html = '';
                activeOrders.forEach(function(o, i) {
                    var vehName = o.vehicle ? (escHtml(o.vehicle.make) + (o.vehicle.model ? ' ' + escHtml(o.vehicle.model) : '') + (o.vehicle.year ? ' - ' + o.vehicle.year : '')) : 'Véhicule';
                    var plate = o.vehicle && o.vehicle.plate ? escHtml(o.vehicle.plate) : '';
                    var empName = o.employee ? escHtml(o.employee.first_name + ' ' + o.employee.last_name) : 'Inconnu';
                    var owner = o.vehicle ? escHtml(o.vehicle.owner_name) : '';

                    html += '<div class="monitoring-order">' +
                        '<div class="monitoring-order__info">' +
                            '<div class="monitoring-order__dot" id="monitoring-dot-' + i + '"></div>' +
                            '<div class="monitoring-order__text">' +
                                '<div class="monitoring-order__vehicle">' + vehName + (plate ? ' - ' + plate : '') + '</div>' +
                                '<div class="monitoring-order__employee">' + owner + ' - <span class="monitoring-order__emp-name">' + empName + '</span>' + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="monitoring-order__right-text">' +
                            '<div class="monitoring-order__timer" id="monitoring-timer-' + i + '">00:00:00</div>' +
                            '<div class="monitoring-order__started">' + formatDateTime(o.started_at) + '</div>' +
                        '</div>' +
                        '<span class="monitoring-stop-strip" onclick="Control.stopWorkOrder(\'' + o.vehicle_id + '\',\'' + escHtml(vehName) + '\')" title="Arrêter le bon de travail"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="6" width="12" height="12" rx="1"/></svg></span>' +
                        '<span class="monitoring-status-strip" onclick="Control.toggleOrderPause(\'' + o.id + '\',' + i + ')">' +
                            '<span class="monitoring-status-strip__play">▶</span>' +
                            '<span class="monitoring-status-strip__pause">⏸</span>' +
                        '</span>' +
                    '</div>';
                });
                activeEl.innerHTML = html;
                checkPauseBoundaries(activeOrders);

                // Start live timers
                activeOrders.forEach(function(o, i) {
                    var el = document.getElementById('monitoring-timer-' + i);
                    if (!el) return;
                    var card = el.closest('.monitoring-order');
                    var dot = card ? card.querySelector('.monitoring-order__dot') : null;
                    var start = new Date(o.started_at).getTime();
                    if (start > Date.now()) start = Date.now();
                    var wasPaused = null;
                    function tick() {
                        var now = Date.now();
                        var paused = monitoringPauseOverrides[o.id] !== undefined
                            ? monitoringPauseOverrides[o.id] : !!o.paused;
                        el.textContent = formatDurationLong(calcWorkingSeconds(start, now));
                        if (paused !== wasPaused) {
                            wasPaused = paused;
                            el.classList.toggle('monitoring-order__timer--paused', paused);
                            if (card) card.classList.toggle('monitoring-order--paused', paused);
                            if (dot) dot.classList.toggle('monitoring-order__dot--paused', paused);
                        }
                    }
                    tick();
                    monitoringTimers.push(setInterval(tick, 1000));
                });
            }

            // Recent completed orders
            var completed = recentOrders.filter(function(o) { return o.ended_at; });
            if (completed.length === 0) {
                recentEl.innerHTML = '<div class="monitoring-empty">Aucune activité récente</div>';
            } else {
                var rHtml = '';
                completed.slice(0, 20).forEach(function(o) {
                    var vehName = o.vehicle ? (escHtml(o.vehicle.make) + (o.vehicle.year ? ' ' + o.vehicle.year : '')) : 'Véhicule';
                    var empName = o.employee ? escHtml(o.employee.first_name + ' ' + o.employee.last_name) : 'Inconnu';
                    var duration = o.duration_seconds ? formatDuration(o.duration_seconds) : '';

                    rHtml += '<div class="monitoring-recent-item">' +
                        '<div class="monitoring-recent-item__icon monitoring-recent-item__icon--end"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/></svg></div>' +
                        '<div class="monitoring-recent-item__text">' + empName + ' → ' + vehName + (duration ? ' <span style="color:var(--text-muted);">(' + duration + ')</span>' : '') + '</div>' +
                        '<div class="monitoring-recent-item__time">' + formatDateTime(o.ended_at) + '</div>' +
                    '</div>';
                });
                recentEl.innerHTML = rHtml;
            }

            // Auto-refresh every 5 seconds
            clearInterval(monitoringInterval);
            monitoringInterval = setInterval(function() {
                var panel = document.getElementById('panel-monitoring');
                if (panel && panel.classList.contains('active')) {
                    loadMonitoring();
                } else {
                    clearInterval(monitoringInterval);
                    monitoringInterval = null;
                }
            }, 5000);

        } catch(e) {
            statsEl.innerHTML = '<div class="monitoring-empty">Erreur: ' + escHtml(e.message) + '</div>';
        }
    }

    function stopMonitoringTimers() {
        monitoringTimers.forEach(function(t) { clearInterval(t); });
        monitoringTimers = [];
    }

    // ---- INIT ----

    // Expose for inline onclick
    window._controlModule = {
        cancelNfcAssign: function() { nfcAssignCallback = null; },
        initControl: function() { initControl(); }
    };

    function init() {
        // (needs adminPassword to be set for the API call)
        initSubtabs();
        initPhotoUpload();
        initDatepicker();
        initVehicleValidation();
        connectNfcWebSocket();

        // Notifications
        document.getElementById('notif-toggle').addEventListener('click', toggleNotifPanel);
        document.getElementById('notif-clear').addEventListener('click', clearNotifications);

        // Employee modal buttons
        var empModal = document.getElementById('employee-modal');
        document.getElementById('emp-cancel').addEventListener('click', function() { empModal.classList.remove('active'); });
        document.getElementById('employee-modal-close').addEventListener('click', function() { empModal.classList.remove('active'); });
        document.getElementById('emp-save').addEventListener('click', saveEmployee);
        document.getElementById('btn-new-employee').addEventListener('click', function() { openEmployeeModal(null); });
        // empModal overlay click disabled - close only via X button

        // Employee NFC assign
        document.getElementById('emp-assign-nfc').addEventListener('click', function() {
            assignNfc(async function(tagId) {
                var conflict = await checkNfcConflict(tagId, 'employee', document.getElementById('emp-edit-id').value);
                if (conflict) {
                    showToast('warning', 'Badge déjà assigné', conflict);
                    return;
                }
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
                        showToast('warning', 'Action impossible', 'Cet employé a un bon de travail ouvert.');
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
        // empStatsModal overlay click disabled - close only via X button
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
        // vehModal overlay click disabled - close only via X button

        // Vehicle NFC assign
        document.getElementById('veh-assign-nfc').addEventListener('click', function() {
            assignNfc(async function(tagId) {
                var conflict = await checkNfcConflict(tagId, 'vehicle', document.getElementById('veh-edit-id').value);
                if (conflict) {
                    showToast('warning', 'Badge déjà assigné', conflict);
                    return;
                }
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
                        showToast('warning', 'Action impossible', 'Ce véhicule a un bon de travail ouvert.');
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
        // vehDetailModal overlay click disabled - close only via X button

        // Confirm delete modal
        var confirmModal = document.getElementById('control-confirm-modal');
        document.getElementById('control-confirm-close').addEventListener('click', function() { confirmModal.classList.remove('active'); });
        document.getElementById('control-cancel-delete').addEventListener('click', function() { confirmModal.classList.remove('active'); });
        document.getElementById('control-confirm-delete').addEventListener('click', function() {
            confirmModal.classList.remove('active');
            if (deleteCallback) { deleteCallback(); deleteCallback = null; }
        });
        // confirmModal overlay click disabled - close only via X button

        // Media tab
        var btnClassify = document.getElementById('btn-media-classify');
        if (btnClassify) btnClassify.addEventListener('click', function() {
            if (!allVehicles.length) loadVehicles().then(enterClassifyMode);
            else enterClassifyMode();
        });
        var btnAssign = document.getElementById('btn-media-assign');
        if (btnAssign) btnAssign.addEventListener('click', assignSelectedMedia);
        var btnCancelClassify = document.getElementById('btn-media-classify-cancel');
        if (btnCancelClassify) btnCancelClassify.addEventListener('click', exitClassifyMode);
        var btnDeleteMode = document.getElementById('btn-media-delete-mode');
        if (btnDeleteMode) btnDeleteMode.addEventListener('click', enterDeleteMode);
        var btnDeleteConfirm = document.getElementById('btn-media-delete-confirm');
        if (btnDeleteConfirm) btnDeleteConfirm.addEventListener('click', deleteSelectedMedia);
        var btnDeleteCancel = document.getElementById('btn-media-delete-cancel');
        if (btnDeleteCancel) btnDeleteCancel.addEventListener('click', exitDeleteMode);

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
        empStatsGoTo: empStatsGoTo,
        openVehicleDetail: openVehicleDetail,
        editVehicle: editVehicle,
        deleteVehicle: deleteVehicle,
        vehGoTo: vehGoTo,
        vehDetailGoTo: vehDetailGoTo,
        addVehicleNote: addVehicleNote,
        deleteVehicleNote: deleteVehicleNote,
        simulateNfc: simulateNfc,
        toggleMediaSelect: toggleMediaSelect,
        copyMediaLink: function(token) { copyToClipboard(mediaShareUrl(token)); },
        openMediaFull: openMediaFull,
        unassignMedia: function(id) { unassignMedia(id); },
        stopWorkOrder: stopWorkOrder,
        toggleOrderPause: toggleOrderPause
    };

})();
