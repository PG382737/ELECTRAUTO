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
    var scannerVehicleOrders = [];
    var scannerEmployee = null;     // employe dont le profil est affiche
    var scannerArmed = false;       // son badge repasse une 2e fois change son statut IN/OUT
    var scannerActiveOrder = null;
    var scannerVehicle = null;
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
        var locale = currentLang === 'en' ? 'en-CA' : 'fr-CA';
        var sep = currentLang === 'en' ? ' at ' : ' \u00e0 ';
        return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) + sep +
               d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
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

    // Simple elapsed time: (end - start) in seconds
    function elapsedSeconds(startMs, endMs) {
        return Math.max(0, Math.round((endMs - startMs) / 1000));
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
    function getMonths() { return t('datepicker.months'); }
    function getWeekdays() { return t('datepicker.weekdays'); }

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
        html += '<span class="datepicker-month-year">' + getMonths()[month] + ' ' + year + '</span>';
        html += '<button type="button" onclick="window._dpNext(event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>';
        html += '</div>';

        html += '<div class="datepicker-weekdays">';
        getWeekdays().forEach(function(d) { html += '<span>' + d + '</span>'; });
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
        html += '<button type="button" class="datepicker-today-btn" onclick="window._dpToday(event)">' + t('datepicker.today') + '</button>';

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
        html += '<button class="btn btn--ghost btn--sm" ' + (currentPage === 0 ? 'disabled' : 'onclick="' + fnName + '(' + (currentPage - 1) + ')"') + '>' + t('pagination.prev') + '</button>';
        html += '<span class="control-pagination__info">' + t('pagination.page').replace('{current}', currentPage + 1).replace('{total}', totalPages) + '</span>';
        html += '<button class="btn btn--ghost btn--sm" ' + (currentPage >= totalPages - 1 ? 'disabled' : 'onclick="' + fnName + '(' + (currentPage + 1) + ')"') + '>' + t('pagination.next') + '</button>';
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
                    lastMediaSignature = '';
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
                } else if (target === 'presences') {
                    document.getElementById('panel-presences').classList.add('active');
                    initPresencesNav();
                    loadPresences();
                    clearInterval(presencePollingInterval);
                    presencePollingInterval = setInterval(function() {
                        var panel = document.getElementById('panel-presences');
                        if (panel && panel.classList.contains('active')) {
                            loadPresences();
                        } else {
                            clearInterval(presencePollingInterval);
                            presencePollingInterval = null;
                        }
                    }, 20000);
                } else if (target === 'scanner') {
                    document.getElementById('panel-scanner').classList.add('active');
                }
            });
        });
    }

    // ---- PRESENCES ----
    // Le design vient du prototype valide avec le client (preview-admin-presences.html).

    var presencePollingInterval = null;
    var presView = 'today';
    var presData = { rows: [], events: [] };

    var PR_ICONS = {
        users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
        alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        car: '<circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9"/>'
    };
    function prSvg(name) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PR_ICONS[name] || '') + '</svg>';
    }

    var PR_EVENTS = {
        in:          { label: 'Punch IN',         tone: 'in' },
        out:         { label: 'Punch OUT',        tone: 'out' },
        job_start:   { label: 'Job commenc\u00e9e',    tone: 'job' },
        job_end:     { label: 'Job termin\u00e9e',     tone: 'done' },
        refus_out:   { label: 'Punch OUT refus\u00e9', tone: 'bad' },
        refus_job:   { label: 'Job refus\u00e9e',      tone: 'bad' },
        inconnu:     { label: 'Badge inconnu',    tone: 'bad' },
        correction:  { label: 'Correction',       tone: 'admin' },
        ajout:       { label: 'Punch ajout\u00e9',     tone: 'admin' },
        suppression: { label: 'Punch supprim\u00e9',   tone: 'admin' }
    };
    var NBSP = '\u00a0';

    function prHM(iso) {
        if (!iso) return '--:--';
        return new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Toronto' });
    }
    function prDay(iso) {
        return new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', timeZone: 'America/Toronto' });
    }
    function prDateLong(d) {
        return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Toronto' });
    }
    function prCap1(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
    function prDur(ms) {
        if (!ms || ms < 30000) return '\u2014';
        var min = Math.round(ms / 60000), h = Math.floor(min / 60);
        return h > 0 ? h + NBSP + 'h' + NBSP + String(min % 60).padStart(2, '0') : min + NBSP + 'min';
    }
    function prName(e) { return (((e && e.first_name) || '') + ' ' + ((e && e.last_name) || '')).trim(); }
    function prHue(id) {
        var n = 0, str = String(id || '');
        for (var i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) % 997;
        return (n * 137) % 360;
    }
    function prAvatar(e) {
        var h = prHue(e && e.id);
        var ini = (((e && e.first_name) || '?').charAt(0) + ((e && e.last_name) || '?').charAt(0)).toUpperCase();
        return '<span class="pr-av" style="--c1:hsl(' + h + ',62%,62%);--c2:hsl(' + ((h + 38) % 360) + ',62%,48%)">' + escHtml(ini) + '</span>';
    }
    function prEmpCell(e) { return '<span class="pr-emp">' + prAvatar(e) + '<span>' + escHtml(prName(e)) + '</span></span>'; }
    function prKpi(icon, tone, value, label) {
        return '<div class="monitoring-card"><div class="pr-ic pr-ic--' + tone + '">' + prSvg(icon) + '</div>' +
            '<div><div class="monitoring-card__value">' + value + '</div><div class="monitoring-card__label">' + label + '</div></div></div>';
    }
    function prEvBadge(type) {
        var t = PR_EVENTS[type] || { label: type, tone: 'admin' };
        return '<span class="pr-ev pr-ev--' + t.tone + '">' + t.label + '</span>';
    }
    function prVehLabel(v) {
        if (!v) return '';
        return ((v.make || '') + (v.year ? ' ' + v.year : '') + (v.plate ? ' \u00b7 ' + v.plate : '')).trim();
    }

    // Minuit aujourd'hui, heure de Toronto
    function presDayStart() {
        var et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
        return Date.now() - (et.getHours() * 3600000 + et.getMinutes() * 60000 + et.getSeconds() * 1000 + et.getMilliseconds());
    }

    // Chaque punch est borne a la journee en cours : sinon un oubli de punch OUT de la
    // veille ajouterait des dizaines d'heures au total du jour.
    // Le diner n'est pas deduit : l'employe punch OUT/IN s'il quitte (decision client).
    function presWorkedMs(punches) {
        var now = Date.now(), dayStart = presDayStart();
        return (punches || []).reduce(function (sum, p) {
            var start = Math.max(new Date(p.punch_in).getTime(), dayStart);
            var end = Math.min(p.punch_out ? new Date(p.punch_out).getTime() : now, now);
            return sum + Math.max(0, end - start);
        }, 0);
    }

    var presencesNavReady = false;
    function initPresencesNav() {
        if (presencesNavReady) return;
        presencesNavReady = true;
        document.getElementById('panel-presences').addEventListener('click', function (ev) {
            var btn = ev.target.closest('[data-prview]');
            if (!btn) return;
            presView = btn.dataset.prview;
            renderPresences();
        });
    }

    async function loadPresences() {
        if (!document.getElementById('pv-today')) return;
        try {
            var results = await Promise.all([
                api('GET', '/api/control-punches?today=true'),
                api('GET', '/api/control-punches?history=true&limit=120')
            ]);
            presData.rows = results[0] || [];
            presData.events = results[1] || [];
            renderPresences();
        } catch (err) {
            document.getElementById('pv-today').innerHTML =
                '<div class="pr-card"><div class="pr-empty">Erreur de chargement\u00a0: ' + escHtml(err.message) + '</div></div>';
        }
    }

    function renderPresences() {
        document.querySelectorAll('#panel-presences [data-prview]').forEach(function (b) {
            b.classList.toggle('active', b.dataset.prview === presView);
        });
        document.getElementById('pv-today').classList.toggle('is-active', presView === 'today');
        document.getElementById('pv-history').classList.toggle('is-active', presView === 'history');
        if (presView === 'today') renderPresToday(); else renderPresHistory();
    }

    function renderPresToday() {
        var rows = presData.rows.slice().sort(function (a, b) {
            return (!!b.is_in - !!a.is_in) || prName(a).localeCompare(prName(b), 'fr');
        });
        var inNow = rows.filter(function (r) { return r.is_in; }).length;
        var openJobs = rows.reduce(function (n, r) { return n + (r.open_jobs || []).length; }, 0);
        var forgotten = rows.filter(function (r) { return r.forgotten; });
        var totalMs = rows.reduce(function (sum, r) { return sum + presWorkedMs(r.punches); }, 0);
        var today = presDayStart();

        document.getElementById('pv-today').innerHTML =
            '<div class="pr-kpis">' +
                prKpi('users', 'green', inNow + NBSP + '/' + NBSP + rows.length, 'Au travail maintenant') +
                prKpi('clock', 'blue', prDur(totalMs), 'Heures travaill\u00e9es aujourd\u2019hui') +
                prKpi('wrench', 'orange', openJobs, 'Jobs en cours') +
                prKpi('alert', forgotten.length ? 'red' : 'grey', forgotten.length, forgotten.length > 1 ? 'Punchs \u00e0 corriger' : 'Punch \u00e0 corriger') +
            '</div>' +
            (forgotten.length
                ? '<div class="pr-card"><div class="pr-card__head"><h2>\u00c0 corriger</h2></div>' + forgotten.map(prAlertRow).join('') + '</div>'
                : '') +
            '<div class="pr-card">' +
                '<div class="pr-card__head"><h2>Statut des employ\u00e9s</h2><span class="pr-muted">' + prCap1(prDateLong(new Date())) + '</span></div>' +
                (rows.length
                    ? '<div class="pr-table-wrap"><table class="control-table">' +
                        '<thead><tr><th>Employ\u00e9</th><th>Statut</th><th>Arriv\u00e9e</th><th>D\u00e9part</th><th class="num">Travaill\u00e9es</th><th>Jobs en cours</th></tr></thead>' +
                        '<tbody>' + rows.map(prTodayRow).join('') + '</tbody></table></div>'
                    : '<div class="pr-empty">Aucun employ\u00e9.</div>') +
            '</div>' +
            '<div class="pr-card">' +
                '<div class="pr-card__head"><h2>Activit\u00e9 du jour</h2>' +
                '<button class="btn btn--ghost btn--sm" data-prview="history">Tout l\u2019historique</button></div>' +
                prFeed(today) +
            '</div>';
    }

    function prAlertRow(r) {
        var since = new Date(r.open_punch.punch_in);
        var hours = Math.floor((Date.now() - since.getTime()) / 3600000);
        return '<div class="pr-alert pr-alert--critical">' + prSvg('alert') +
            '<div class="pr-alert__text"><b>' + escHtml(prName(r)) + '</b> est encore IN depuis ' +
            prDay(r.open_punch.punch_in) + ' \u00e0 ' + prHM(r.open_punch.punch_in) +
            ' (' + hours + NBSP + 'h). Probablement un oubli de punch OUT.</div></div>';
    }

    function prTodayRow(r) {
        var punches = (r.punches || []).slice().sort(function (a, b) {
            return new Date(a.punch_in) - new Date(b.punch_in);
        });
        var first = punches[0] || null;
        var lastClosed = null;
        punches.forEach(function (p) { if (p.punch_out) lastClosed = p; });

        var status = r.is_in
            ? (r.forgotten
                ? '<span class="pr-pill pr-pill--bad"><i></i>IN depuis ' + prDay(r.open_punch.punch_in) + ' ' + prHM(r.open_punch.punch_in) + '</span>'
                : '<span class="pr-pill pr-pill--in"><i></i>IN</span> <span class="pr-muted">depuis ' + prHM(r.open_punch.punch_in) + '</span>')
            : '<span class="pr-pill">OUT</span>';

        var jobs = (r.open_jobs || []);
        var shown = jobs.slice(0, 2);
        var jobsHtml = jobs.length
            ? shown.map(function (j) {
                var v = j.vehicle || {};
                return '<span class="pr-chip">' + escHtml(v.make || 'V\u00e9hicule') +
                    '<b data-pr-since="' + j.started_at + '">' + prDur(Date.now() - new Date(j.started_at).getTime()) + '</b></span>';
              }).join('') + (jobs.length > 2 ? '<span class="pr-tag">+' + (jobs.length - 2) + '</span>' : '')
            : '<span class="pr-muted">\u2014</span>';

        return '<tr>' +
            '<td>' + prEmpCell(r) + '</td>' +
            '<td>' + status + '</td>' +
            '<td>' + (first ? prHM(first.punch_in) : '<span class="pr-muted">\u2014</span>') + '</td>' +
            '<td>' + (lastClosed && !r.is_in ? prHM(lastClosed.punch_out) : r.is_in ? '<span class="pr-muted">en cours</span>' : '<span class="pr-muted">\u2014</span>') + '</td>' +
            '<td class="num pr-strong">' + prDur(presWorkedMs(r.punches)) + '</td>' +
            '<td>' + jobsHtml + '</td>' +
        '</tr>';
    }

    function prFeed(fromMs) {
        var list = presData.events.filter(function (e) { return new Date(e.occurred_at).getTime() >= fromMs; }).slice(0, 8);
        if (!list.length) return '<div class="pr-empty">Aucune activit\u00e9 aujourd\u2019hui pour l\u2019instant.</div>';
        return list.map(function (e) {
            var detail = [e.vehicle ? prVehLabel(e.vehicle) : '', e.detail].filter(Boolean).join(' \u00b7 ');
            return '<div class="pr-feed__row">' +
                '<span class="pr-time">' + prHM(e.occurred_at) + '</span>' +
                prEvBadge(e.type) +
                '<span>' + (e.employee ? escHtml(prName(e.employee)) : '<span class="pr-muted">\u2014</span>') + '</span>' +
                '<span class="pr-muted">' + escHtml(detail) + '</span>' +
            '</div>';
        }).join('');
    }

    function renderPresHistory() {
        var list = presData.events;
        document.getElementById('pv-history').innerHTML =
            '<div class="pr-filters">' +
                '<span class="pr-count">' + list.length.toLocaleString('fr-CA') + ' \u00e9v\u00e9nement' + (list.length > 1 ? 's' : '') + '</span>' +
            '</div>' +
            '<div class="pr-card">' +
                (list.length
                    ? '<div class="pr-table-wrap"><table class="control-table">' +
                        '<thead><tr><th>Date</th><th>Heure</th><th>Employ\u00e9</th><th>\u00c9v\u00e9nement</th><th>V\u00e9hicule</th><th>D\u00e9tail</th><th>Source</th></tr></thead>' +
                        '<tbody>' + list.map(function (e) {
                            return '<tr>' +
                                '<td>' + prDay(e.occurred_at) + '</td>' +
                                '<td class="pr-time">' + prHM(e.occurred_at) + '</td>' +
                                '<td>' + (e.employee ? prEmpCell(e.employee) : '<span class="pr-muted">\u2014</span>') + '</td>' +
                                '<td>' + prEvBadge(e.type) + '</td>' +
                                '<td>' + (e.vehicle ? escHtml(prVehLabel(e.vehicle)) : '<span class="pr-muted">\u2014</span>') + '</td>' +
                                '<td class="pr-muted">' + (escHtml(e.detail) || '\u2014') + '</td>' +
                                '<td><span class="pr-src ' + (e.source === 'admin' ? 'pr-src--admin' : '') + '">' + (e.source === 'admin' ? 'Admin' : 'Terminal') + '</span></td>' +
                            '</tr>';
                        }).join('') + '</tbody></table></div>'
                    : '<div class="pr-empty">Aucun \u00e9v\u00e9nement pour le moment.</div>') +
            '</div>';
    }

    // Les chronos des jobs en cours avancent sans recharger la page
    setInterval(function () {
        document.querySelectorAll('#panel-presences [data-pr-since]').forEach(function (el) {
            el.textContent = prDur(Date.now() - new Date(el.getAttribute('data-pr-since')).getTime());
        });
    }, 30000);

    // ---- EMPLOYEES ----

    async function loadEmployees() {
        var container = document.getElementById('employees-list');
        if (!container) return;
        try {
            allEmployees = await api('GET', '/api/control-employees');
            empPage = 0;
            renderEmployees();
        } catch(e) {
            container.innerHTML = '<div class="control-empty"><p>' + t('general.error_prefix') + escHtml(e.message) + '</p></div>';
        }
    }

    function renderEmployees() {
        var container = document.getElementById('employees-list');
        var data = allEmployees;
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="control-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>' + t('emp.empty') + '</p></div>';
            return;
        }
        var totalPages = Math.ceil(data.length / PAGE_SIZE);
        var page = Math.min(empPage, totalPages - 1);
        var start = page * PAGE_SIZE;
        var pageData = data.slice(start, start + PAGE_SIZE);

        var html = '<table class="control-table"><thead><tr><th>' + t('emp.col_name') + '</th><th>' + t('emp.col_hire_date') + '</th><th>' + t('emp.col_nfc') + '</th><th style="text-align:right;">' + t('emp.col_actions') + '</th></tr></thead><tbody>';
        pageData.forEach(function(emp) {
            var nfcBadge = emp.nfc_tag_id
                ? '<span class="nfc-badge nfc-badge--assigned">' + t('emp.nfc_assigned') + '</span>'
                : '<span class="nfc-badge nfc-badge--unassigned">' + t('emp.nfc_unassigned') + '</span>';
            html += '<tr>';
            html += '<td class="col-name clickable-row" onclick="Control.openEmployeeStats(\'' + emp.id + '\')">' + escHtml(emp.first_name + ' ' + emp.last_name) + '</td>';
            html += '<td>' + formatDate(emp.hire_date) + '</td>';
            html += '<td>' + nfcBadge + '</td>';
            html += '<td><div class="col-actions col-actions--icons">';
            html += '<button class="icon-btn" title="Stats" onclick="Control.openEmployeeStats(\'' + emp.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></button>';
            html += '<button class="icon-btn" title="Heures facturées" onclick="Control.openBilledHours(\'' + emp.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>';
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
        document.getElementById('employee-modal-title').textContent = emp ? t('emp.modal_edit') : t('emp.modal_new');
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
            showToast('error', t('general.error'), e.message);
        }
    }

    async function editEmployee(id) {
        try {
            var emp = await api('GET', '/api/control-employees?id=' + id);
            openEmployeeModal(emp);
        } catch(e) {
            showToast('error', t('general.error'), e.message);
        }
    }

    function deleteEmployee(id) {
        showConfirmDelete(t('emp.delete_title'), t('emp.delete_msg'), async function() {
            try {
                await api('DELETE', '/api/control-employees?id=' + id);
                loadEmployees();
            } catch(e) { showToast('error', t('general.error'), e.message); }
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
            populateMonthPicker();
            document.getElementById('emp-stats-month').value = '';
            loadEmployeeStats('month');
        } catch(e) {
            showToast('error', t('general.error'), e.message);
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
            var billedData = await api('GET', '/api/employee-billed-hours?employee_id=' + currentEmpStatsId);
            var stats = data.stats;

            document.getElementById('emp-stat-hours').textContent = formatDuration(stats.total_seconds);
            document.getElementById('emp-stat-vehicles').textContent = stats.vehicle_count;
            document.getElementById('emp-stat-avg').textContent = formatDuration(stats.avg_seconds_per_vehicle);

            // Calculate billed hours for the selected period
            var billedHours = getBilledForPeriod(billedData || [], period);
            var workedHours = stats.total_seconds / 3600;
            var efficiency = workedHours > 0 ? Math.round((billedHours / workedHours) * 100) : 0;

            document.getElementById('emp-stat-billed').textContent = billedHours > 0 ? billedHours.toFixed(1) + ' h' : '-';
            var effEl = document.getElementById('emp-stat-efficiency');
            if (billedHours > 0 && workedHours > 0) {
                effEl.textContent = efficiency + '%';
                effEl.style.color = efficiency >= 80 ? 'var(--success)' : efficiency >= 50 ? 'var(--accent)' : 'var(--danger)';
            } else {
                effEl.textContent = '-';
                effEl.style.color = '';
            }

            empStatsOrders = data.orders || [];
            renderEmpStatsHistory();
        } catch(e) {
            document.getElementById('emp-stats-history').innerHTML = '<p style="color:var(--danger);">' + t('general.error_prefix') + escHtml(e.message) + '</p>';
        }
    }

    function getBilledForPeriod(entries, period) {
        if (!entries || entries.length === 0) return 0;
        var now = new Date();
        var total = 0;
        entries.forEach(function(e) {
            var parts = e.month.split('-');
            var entryYear = parseInt(parts[0]);
            var entryMonth = parseInt(parts[1]) - 1;
            var include = false;
            if (period.startsWith('month:')) {
                var mp = period.split(':')[1].split('-');
                include = entryYear === parseInt(mp[0]) && entryMonth === parseInt(mp[1]) - 1;
            } else if (period === 'month') {
                include = entryYear === now.getFullYear() && entryMonth === now.getMonth();
            } else if (period === 'year') {
                include = entryYear === now.getFullYear();
            } else if (period === 'all') {
                include = true;
            } else if (period === 'week' || period === 'day') {
                include = entryYear === now.getFullYear() && entryMonth === now.getMonth();
            }
            if (include) total += parseFloat(e.billed_hours) || 0;
        });
        return total;
    }

    function renderEmpStatsHistory() {
        var historyEl = document.getElementById('emp-stats-history');
        if (empStatsOrders.length === 0) {
            historyEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;">' + t('emp_stats.no_orders') + '</p>';
            return;
        }
        var totalPages = Math.ceil(empStatsOrders.length / HISTORY_PAGE_SIZE);
        var page = Math.min(empStatsPage, totalPages - 1);
        var start = page * HISTORY_PAGE_SIZE;
        var pageData = empStatsOrders.slice(start, start + HISTORY_PAGE_SIZE);

        var html = '<table class="control-table"><thead><tr><th>' + t('emp_stats.col_date') + '</th><th>' + t('emp_stats.col_vehicle') + '</th><th>' + t('emp_stats.col_duration') + '</th></tr></thead><tbody>';
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

    // ---- EMPLOYEE BILLED HOURS ----

    var currentBilledEmpId = null;
    var currentBilledEmpName = '';
    var billedHoursData = [];
    var editingBilledId = null;

    async function openBilledHours(id) {
        currentBilledEmpId = id;
        editingBilledId = null;
        try {
            var emp = await api('GET', '/api/control-employees?id=' + id);
            currentBilledEmpName = emp.first_name + ' ' + emp.last_name;
            document.getElementById('billed-hours-title').textContent = 'Heures facturées — ' + currentBilledEmpName;
            document.getElementById('billed-hours-modal').classList.add('active');
            resetBilledForm();
            loadBilledHours();
        } catch(e) {
            showToast('error', 'Erreur', e.message);
        }
    }

    function resetBilledForm() {
        editingBilledId = null;
        var now = new Date();
        var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        document.getElementById('bh-month').value = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
        document.getElementById('bh-hours').value = '';
        document.getElementById('bh-note').value = '';
        document.getElementById('bh-save').textContent = 'Ajouter';
        document.getElementById('bh-cancel').style.display = 'none';
    }

    async function loadBilledHours() {
        if (!currentBilledEmpId) return;
        var listEl = document.getElementById('billed-hours-list');
        try {
            billedHoursData = await api('GET', '/api/employee-billed-hours?employee_id=' + currentBilledEmpId);
            renderBilledHours();
        } catch(e) {
            listEl.innerHTML = '<p style="color:var(--danger);">Erreur: ' + escHtml(e.message) + '</p>';
        }
    }

    function renderBilledHours() {
        var listEl = document.getElementById('billed-hours-list');
        if (!billedHoursData || billedHoursData.length === 0) {
            listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;">Aucune entrée.</p>';
            return;
        }
        var html = '<table class="control-table"><thead><tr><th>Mois</th><th style="text-align:right;">Heures facturées</th><th>Note</th><th style="text-align:right;">Actions</th></tr></thead><tbody>';
        billedHoursData.forEach(function(entry) {
            var monthLabel = formatMonth(entry.month);
            html += '<tr>';
            html += '<td>' + escHtml(monthLabel) + '</td>';
            html += '<td style="text-align:right;font-weight:600;">' + parseFloat(entry.billed_hours).toFixed(2) + ' h</td>';
            html += '<td style="color:var(--text-muted);font-size:0.85rem;">' + escHtml(entry.note || '') + '</td>';
            html += '<td><div class="col-actions col-actions--icons" style="justify-content:flex-end;">';
            html += '<button class="icon-btn" title="Modifier" onclick="Control.editBilledHour(\'' + entry.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
            html += '<button class="icon-btn icon-btn--danger" title="Supprimer" onclick="Control.deleteBilledHour(\'' + entry.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>';
            html += '</div></td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
        listEl.innerHTML = html;
    }

    var MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

    function formatMonth(dateStr) {
        var parts = dateStr.split('-');
        var m = parseInt(parts[1]) - 1;
        return MONTH_NAMES[m] + ' ' + parts[0];
    }

    function populateMonthPicker() {
        var sel = document.getElementById('emp-stats-month');
        var now = new Date();
        var html = '<option value="">Mois...</option>';
        for (var i = 0; i < 12; i++) {
            var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            var val = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            html += '<option value="' + val + '">' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear() + '</option>';
        }
        sel.innerHTML = html;
    }

    async function saveBilledHour() {
        var monthVal = document.getElementById('bh-month').value;
        var hoursVal = parseFloat(document.getElementById('bh-hours').value);
        var noteVal = document.getElementById('bh-note').value.trim();

        if (!monthVal || isNaN(hoursVal) || hoursVal < 0) {
            showToast('error', 'Erreur', 'Veuillez entrer un mois et un nombre d\'heures valide.');
            return;
        }

        try {
            if (editingBilledId) {
                await api('PATCH', '/api/employee-billed-hours', {
                    id: editingBilledId,
                    billed_hours: hoursVal,
                    note: noteVal
                });
                showToast('success', 'Modifié', 'Entrée mise à jour.');
            } else {
                await api('POST', '/api/employee-billed-hours', {
                    employee_id: currentBilledEmpId,
                    month: monthVal + '-01',
                    billed_hours: hoursVal,
                    note: noteVal
                });
                showToast('success', 'Ajouté', 'Heures facturées enregistrées.');
            }
            resetBilledForm();
            loadBilledHours();
        } catch(e) {
            showToast('error', 'Erreur', e.message);
        }
    }

    function editBilledHour(id) {
        var entry = billedHoursData.find(function(e) { return e.id === id; });
        if (!entry) return;
        editingBilledId = id;
        var parts = entry.month.split('-');
        document.getElementById('bh-month').value = parts[0] + '-' + parts[1];
        document.getElementById('bh-hours').value = entry.billed_hours;
        document.getElementById('bh-note').value = entry.note || '';
        document.getElementById('bh-save').textContent = 'Modifier';
        document.getElementById('bh-cancel').style.display = '';
    }

    function cancelBilledEdit() {
        resetBilledForm();
    }

    async function deleteBilledHour(id) {
        showConfirmDelete('Supprimer cette entrée ?', 'Cette action est irréversible.', async function() {
            try {
                await api('DELETE', '/api/employee-billed-hours?id=' + id);
                showToast('success', 'Supprimé', 'Entrée supprimée.');
                loadBilledHours();
            } catch(e) {
                showToast('error', 'Erreur', e.message);
            }
        });
    }

    var vehDetailOrders = [];
    var vehDetailPage = 0;

    function renderVehDetailHistory() {
        var el = document.getElementById('veh-detail-history');
        if (!el) return;
        if (vehDetailOrders.length === 0) {
            el.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;">' + t('veh_detail.no_history') + '</p>';
            return;
        }
        var totalPages = Math.ceil(vehDetailOrders.length / HISTORY_PAGE_SIZE);
        var page = Math.min(vehDetailPage, totalPages - 1);
        var start = page * HISTORY_PAGE_SIZE;
        var pageData = vehDetailOrders.slice(start, start + HISTORY_PAGE_SIZE);

        var html = '<table class="control-table"><thead><tr><th>' + t('veh_detail.col_date') + '</th><th>' + t('veh_detail.col_employee') + '</th><th>' + t('veh_detail.col_duration') + '</th></tr></thead><tbody>';
        pageData.forEach(function(o) {
            var empName = o.employee ? (o.employee.first_name + ' ' + o.employee.last_name) : t('veh_detail.unknown');
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
            container.innerHTML = '<div class="control-empty"><p>' + t('general.error_prefix') + escHtml(e.message) + '</p></div>';
        }
    }

    function sortVehicles(list) {
        return list.slice().sort(function(a, b) {
            var aActive = a.active_orders && a.active_orders.length ? 2 : 0;
            var bActive = b.active_orders && b.active_orders.length ? 2 : 0;
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
        var html = '<div class="control-search"><input type="text" id="veh-search-input" placeholder="' + escHtml(t('veh.search_placeholder')) + '" value="' + escHtml(vehSearchQuery) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>';

        if (!filtered || filtered.length === 0) {
            if (vehSearchQuery) {
                html += '<div class="control-empty"><p>' + t('veh.no_results') + escHtml(vehSearchQuery) + t('veh.no_results_end') + '</p></div>';
            } else {
                html += '<div class="control-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9"/></svg><p>' + t('veh.empty') + '</p></div>';
            }
            container.innerHTML = html;
            bindVehicleSearch();
            return;
        }

        var totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        var page = Math.min(vehPage, totalPages - 1);
        var start = page * PAGE_SIZE;
        var pageData = filtered.slice(start, start + PAGE_SIZE);

        html += '<table class="control-table"><thead><tr><th>Véhicule</th><th>Badge NFC</th><th>Statut</th><th style="text-align:center;">Médias</th><th style="text-align:right;">Actions</th></tr></thead><tbody>';
        pageData.forEach(function(v) {
            var nfcBadge = v.nfc_tag_id
                ? '<span class="nfc-badge nfc-badge--assigned">' + t('veh.nfc_assigned') + '</span>'
                : '<span class="nfc-badge nfc-badge--unassigned">' + t('veh.nfc_unassigned') + '</span>';

            var aos = v.active_orders || [];
            var statusHtml = '';
            var subLine = escHtml(v.owner_name);
            if (aos.length > 0) {
                var firstAo = aos[0];
                var allPaused = aos.every(function(o) { return !!o.paused; });
                var dotPaused = allPaused;
                var timerId = 'live-veh-' + v.id;
                var dotClass = 'live-dot' + (dotPaused ? ' live-dot--paused' : '');
                statusHtml = '<span class="live-indicator"><span class="' + dotClass + '"></span><span class="live-timer" id="' + timerId + '">...</span></span>';
                var empNames = aos.map(function(o) {
                    var emp = o.employee;
                    var name = emp ? (emp.first_name + ' ' + emp.last_name) : '?';
                    var color = o.paused ? '#f59e0b' : '#22c55e';
                    return '<span style="color:' + color + ';">' + escHtml(name) + '</span>';
                });
                if (empNames.length) subLine += ' - ' + empNames.join(', ');
                setTimeout(function() { startLiveTimer(timerId, firstAo.started_at, allPaused, firstAo.paused_at, firstAo.total_paused_seconds); }, 50);
            } else {
                statusHtml = '<span style="color:var(--text-muted);font-size:0.85rem;">-</span>';
            }

            var vehLabel = escHtml(v.make) + (v.model ? ' ' + escHtml(v.model) : '') + (v.year ? ' - ' + v.year : '');

            html += '<tr>';
            html += '<td class="col-name clickable-row" onclick="Control.openVehicleDetail(\'' + v.id + '\')">' + vehLabel + '<div style="font-size:0.82rem;font-weight:400;color:var(--text-muted);margin-top:2px;">' + subLine + '</div></td>';
            html += '<td>' + nfcBadge + '</td>';
            html += '<td>' + statusHtml + '</td>';
            html += '<td style="text-align:center;color:var(--text-muted);font-size:0.85rem;">' + (v.media_count || 0) + '</td>';
            html += '<td><div class="col-actions col-actions--icons">';
            aos.forEach(function(ao) {
                var aoPaused = !!ao.paused;
                html += '<button class="icon-btn icon-btn--stop" title="Arrêter" onclick="Control.stopWorkOrderById(\'' + ao.id + '\')"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1"/></svg></button>';
                if (aoPaused) {
                    html += '<button class="icon-btn icon-btn--play" id="veh-action-' + ao.id + '" title="Reprendre" onclick="Control.toggleVehiclePause(\'' + ao.id + '\',\'' + v.id + '\')"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg></button>';
                } else {
                    html += '<button class="icon-btn icon-btn--pause" id="veh-action-' + ao.id + '" title="Pause" onclick="Control.toggleVehiclePause(\'' + ao.id + '\',\'' + v.id + '\')"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg></button>';
                }
            });
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

    function startLiveTimer(elementId, startedAt, paused, pausedAt, totalPausedSeconds) {
        var el = document.getElementById(elementId);
        if (!el) return;
        var start = new Date(startedAt).getTime();
        if (start > Date.now()) start = Date.now();
        var pausedAtMs = pausedAt ? new Date(pausedAt).getTime() : null;
        var tps = totalPausedSeconds || 0;
        function update() {
            if (el) {
                var endTime = paused ? (pausedAtMs || Date.now()) : Date.now();
                el.textContent = formatDurationLong(Math.max(0, elapsedSeconds(start, endTime) - tps));
                el.style.color = paused ? '#f59e0b' : '';
            }
        }
        update();
        liveTimers[elementId] = setInterval(update, 1000);
    }

    function openVehicleModal(veh) {
        document.getElementById('vehicle-modal-title').textContent = veh ? t('veh.modal_edit') : t('veh.modal_new');
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
            preview.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:40px;height:40px;color:var(--text-muted);"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><p style="color:var(--text-muted);font-size:0.85rem;margin-top:8px;">' + t('veh.photo_add') + '</p>';
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
                showToast('error', t('general.error_upload'), e.message);
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
            showToast('error', t('general.error'), e.message);
        }
    }

    async function editVehicle(id) {
        try {
            var res = await api('GET', '/api/control-vehicles?id=' + id);
            openVehicleModal(res.vehicle);
        } catch(e) {
            showToast('error', t('general.error'), e.message);
        }
    }

    function deleteVehicle(id) {
        showConfirmDelete(t('veh.delete_title'), t('veh.delete_msg'), async function() {
            try {
                await api('DELETE', '/api/control-vehicles?id=' + id);
                loadVehicles();
            } catch(e) { showToast('error', t('general.error'), e.message); }
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
            html += '<p><strong>' + t('veh_detail.owner') + '</strong> ' + escHtml(v.owner_name) + '</p>';
            if (v.phone) html += '<p><strong>' + t('veh_detail.phone') + '</strong> ' + escHtml(v.phone) + '</p>';
            if (v.email) html += '<p><strong>' + t('veh_detail.email') + '</strong> ' + escHtml(v.email) + '</p>';
            if (v.plate) html += '<p><strong>' + t('veh_detail.plate') + '</strong> ' + escHtml(v.plate) + '</p>';
            if (v.color) html += '<p><strong>' + t('veh_detail.color') + '</strong> ' + escHtml(v.color) + '</p>';
            if (v.vin) html += '<p><strong>' + t('veh_detail.vin') + '</strong> ' + escHtml(v.vin) + '</p>';
            if (v.reference) html += '<p><strong>' + t('veh_detail.reference') + '</strong> ' + escHtml(v.reference) + '</p>';
            html += '</div></div>';

            // Active work orders
            var detailActiveOrders = data.active_orders || [];
            detailActiveOrders.forEach(function(ao, idx) {
                var aoPaused = !!ao.paused;
                var empName = ao.employee ? (ao.employee.first_name + ' ' + ao.employee.last_name) : 'Inconnu';
                var statusLabel = aoPaused ? 'EN PAUSE' : 'EN COURS';
                var statusClass = aoPaused ? ' veh-detail-active--paused' : '';
                var dotClass = 'live-dot' + (aoPaused ? ' live-dot--paused' : '');
                var timerId = 'veh-detail-timer-' + idx;
                html += '<div class="veh-detail-active' + statusClass + '">';
                html += '<div class="veh-detail-active__timer-box"><div class="veh-detail-active__timer" id="' + timerId + '">...</div><span>' + statusLabel + '</span></div>';
                html += '<div class="veh-detail-active__sep"></div>';
                html += '<div class="veh-detail-active__info"><span class="' + dotClass + '"></span><div><strong>' + escHtml(empName) + '</strong><p style="margin:4px 0 0;font-size:0.82rem;color:rgba(255,255,255,0.5);">Depuis ' + formatDateTime(ao.started_at) + '</p></div></div>';
                html += '</div>';
                setTimeout(function() { startLiveTimer(timerId, ao.started_at, aoPaused, ao.paused_at, ao.total_paused_seconds); }, 50);
            });

            // Stats
            html += '<div class="stats-grid" style="margin-bottom:24px;">';
            html += '<div class="stat-card"><div class="stat-card__value">' + data.stats.total_repairs + '</div><div class="stat-card__label">' + t('veh_detail.repairs') + '</div></div>';
            html += '<div class="stat-card"><div class="stat-card__value">' + formatDuration(data.stats.total_seconds) + '</div><div class="stat-card__label">' + t('veh_detail.total_time') + '</div></div>';
            html += '<div class="stat-card"><div class="stat-card__value">' + data.stats.employee_count + '</div><div class="stat-card__label">' + t('veh_detail.employees') + '</div></div>';
            html += '</div>';

            // Work history
            html += '<h3 style="font-size:0.95rem;margin-bottom:12px;">' + t('veh_detail.work_history') + '</h3>';
            vehDetailOrders = data.orders.filter(function(o) { return o.ended_at; });
            vehDetailPage = 0;
            html += '<div id="veh-detail-history"></div>';

            // Médias
            html += '<h3 style="font-size:0.95rem;margin-bottom:12px;margin-top:24px;">Médias</h3>';
            html += '<div id="veh-media-section" style="min-height:40px;"><p style="color:var(--text-muted);font-size:0.85rem;">Chargement...</p></div>';

            // Notes
            html += '<div class="veh-notes">';
            html += '<h3 style="font-size:0.95rem;margin-bottom:12px;">' + t('veh_detail.notes_title') + '</h3>';
            html += '<div class="veh-notes__input">';
            html += '<textarea id="veh-note-text" rows="2" placeholder="' + escHtml(t('veh_detail.note_placeholder')) + '"></textarea>';
            html += '<button class="btn btn--primary" onclick="Control.addVehicleNote()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>';
            html += '</div>';
            html += '<div id="veh-notes-list">';
            if (data.notes && data.notes.length > 0) {
                data.notes.forEach(function(n) {
                    html += renderVehicleNote(n);
                });
            } else {
                html += '<p style="color:var(--text-muted);font-size:0.85rem;">' + t('veh_detail.no_notes') + '</p>';
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
            showToast('error', t('general.error'), e.message);
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
        } catch(e) { showToast('error', t('general.error'), e.message); }
    }

    async function deleteVehicleNote(noteId) {
        try {
            await api('DELETE', '/api/control-vehicle-notes?id=' + noteId);
            openVehicleDetail(currentVehDetailId);
        } catch(e) { showToast('error', t('general.error'), e.message); }
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
            label.textContent = t('nfc.connected');
            label.style.color = c;
            detail.textContent = t('nfc.connected_detail');
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
            label.textContent = t('nfc.no_reader');
            label.style.color = c;
            detail.textContent = t('nfc.no_reader_detail');
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
            label.textContent = t('nfc.disconnected');
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
            modal.innerHTML = '<div class="modal" style="text-align:center;padding:40px;max-width:400px;"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="width:64px;height:64px;margin-bottom:16px;animation:pulse 1.5s infinite;"><rect x="2" y="2" width="20" height="20" rx="4"/><path d="M8 7v10M12 5v14M16 7v10"/></svg><h3 style="margin-bottom:8px;">' + t('nfc.scan_badge') + '</h3><p style="color:var(--muted);margin-bottom:24px;">' + t('nfc.approach_card') + '</p><button class="btn" onclick="document.getElementById(\'nfc-scan-modal\').remove();window._controlModule.cancelNfcAssign();">' + t('nfc.cancel') + '</button></div>';
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
                return t('nfc.conflict_employee') + emps[i].first_name + ' ' + emps[i].last_name + '.';
            }
            // Check vehicles
            var vehs = allVehicles.filter(function(v) { return v.nfc_tag_id === tagId; });
            for (var j = 0; j < vehs.length; j++) {
                if (type === 'vehicle' && currentId && vehs[j].id === currentId) continue;
                return t('nfc.conflict_vehicle') + vehs[j].make + (vehs[j].year ? ' ' + vehs[j].year : '') + (vehs[j].plate ? ' (' + vehs[j].plate + ')' : '') + '.';
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
            showToast('warning', t('nfc.no_reader_warn'), t('nfc.check_usb'));
        } else {
            var tagId = prompt(t('nfc.manual_prompt'));
            if (tagId) callback(tagId.toUpperCase());
        }
    }

    // ---- NFC SCANNER (FULLSCREEN) ----
    // Le design vient du prototype valide avec le client (preview-terminal.html) :
    // ecran 1920x1080 mis a l'echelle, aucune liste, une seule action a la fois.

    var SC_ICONS = {
        nfc: '<path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/>',
        badge: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><path d="M16 10h2"/><path d="M16 14h2"/>',
        car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
        carFront: '<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>',
        login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/>',
        lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
        arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
        plate: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M7 12h10"/>',
        user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
    };
    function scSvg(name, cls) {
        return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (SC_ICONS[name] || '') + '</svg>';
    }
    function scSvgDraw(name) {
        return scSvg(name, 'draw').replace(/<(path|circle|rect|line|polyline|polygon)\b/g, '<$1 pathLength="1"');
    }
    function scTapper(cls) {
        return '<div class="tapper ' + (cls || '') + '"><span></span><span></span><span></span><div class="tapper__core">' + scSvg('nfc') + '</div></div>';
    }

    var SC_SESSION_MS = 10000;   // retour a l'accueil sans nouveau scan
    var SC_FLASH_MS = 5000;      // duree de chaque confirmation plein ecran
    var SC_LOCK_MS = 2000;       // blocage apres chaque scan
    var SC_READY_MS = 900;       // « tu peux repasser ta carte »
    var SC_RING = 785;
    var SC_FLASH_ICON = { in: 'login', out: 'logout', jobStart: 'play', jobEnd: 'check', block: 'lock', unknown: 'help' };

    var scLockUntil = 0, scLockTimers = [], scSessionTimer = 0, scSessionEnd = 0, scFlashTimer = 0, scFlashOn = false, scClockTimer = 0, scRaf = 0;

    function scEl(id) { return document.getElementById(id); }
    function scLockLeft() { return Math.max(0, scLockUntil - Date.now()); }

    function scName(e) { return ((e && e.first_name) || '') + ' ' + ((e && e.last_name) || ''); }
    function scInitials(e) {
        return (((e && e.first_name) || '?').charAt(0) + ((e && e.last_name) || '?').charAt(0)).toUpperCase();
    }
    function scVehName(v) { return ((v && v.make) || 'V\u00e9hicule'); }
    function scVehLine(v) {
        var parts = [scVehName(v) + (v && v.year ? ' ' + v.year : '')];
        if (v && v.plate) parts.push(v.plate);
        return parts.join(' \u00b7 ');
    }
    function scHM(iso) {
        if (!iso) return '--:--';
        return new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Toronto' });
    }
    function scTimerText(sinceIso) {
        var ms = Math.max(0, Date.now() - new Date(sinceIso).getTime());
        var min = Math.floor(ms / 60000), h = Math.floor(min / 60);
        return h > 0 ? h + ':' + String(min % 60).padStart(2, '0') : min + ' min';
    }
    // Une couleur stable par employe, tiree de son identifiant
    function scHue(id) {
        var n = 0, str = String(id || '');
        for (var i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) % 997;
        return (n * 137) % 360;
    }
    function scAvatar(e, cls, isIn) {
        var h = scHue(e && e.id);
        return '<div class="avatar ' + (cls || '') + (isIn ? ' is-in' : '') + '" style="--c1:hsl(' + h + ',62%,62%);--c2:hsl(' + ((h + 38) % 360) + ',62%,48%)">' + escHtml(scInitials(e)) + '<i></i></div>';
    }
    function scTile(t) {
        var cls = ['tile', t.locked ? 'is-locked' : 'tile--' + t.tone, t.primary && !t.locked ? 'is-primary' : ''].join(' ');
        return '<div class="' + cls + '">' +
            '<div class="tile__top">' +
                '<div class="tile__icon">' + scSvg(t.icon) + '</div>' +
                '<div class="tile__step">' + t.step + '</div>' +
                (t.primary && !t.locked ? '<div class="tile__tap">' + scSvg('nfc') + '</div>' : '') +
            '</div>' +
            '<div>' +
                '<div class="tile__action">' + t.action + '</div>' +
                (t.locked ? '<div class="tile__lock">' + scSvg('lock') + t.lock + '</div>' : '<div class="tile__desc">' + t.desc + '</div>') +
            '</div>' +
        '</div>';
    }

    // L'ecran du prototype fait 1920x1080 : on le met a l'echelle de la fenetre
    function fitScannerScreen() {
        var screen = scEl('scanner-screen');
        if (!screen) return;
        var k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        screen.style.transform = 'translate(' + ((window.innerWidth - 1920 * k) / 2) + 'px,' + ((window.innerHeight - 1080 * k) / 2) + 'px) scale(' + k + ')';
    }

    function scSetView(name) {
        ['idle', 'employee', 'vehicle'].forEach(function (v) {
            var el = scEl('scanner-view-' + v);
            if (el) el.classList.toggle('is-active', v === name);
        });
        var screen = scEl('scanner-screen');
        if (screen) screen.setAttribute('data-mood', name === 'idle' ? 'idle' : name === 'vehicle' ? 'vehicle' : (scannerEmployee && scannerEmployee.is_in ? 'in' : 'out'));
    }

    function scTick() {
        var t = scEl('scanner-clock-time'), d = scEl('scanner-clock-date');
        var now = new Date();
        if (t) t.textContent = now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
        if (d) d.textContent = now.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
        document.querySelectorAll('#scanner-screen [data-since]').forEach(function (el) {
            el.textContent = scTimerText(el.getAttribute('data-since'));
        });
        var left = scEl('scanner-session-left');
        if (left && scSessionEnd) left.textContent = 'Retour \u00e0 l\u2019accueil dans ' + Math.max(0, Math.ceil(Math.min(SC_SESSION_MS, scSessionEnd - Date.now()) / 1000)) + ' s';
    }

    function scFrame() {
        var on = scannerState && scannerState !== 'WAITING_VEHICLE' && !scFlashOn && scSessionEnd > 0;
        var sess = scEl('scanner-session');
        if (sess) sess.classList.toggle('is-on', !!on);
        var fill = scEl('scanner-session-fill');
        if (on && fill) fill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, (scSessionEnd - Date.now()) / SC_SESSION_MS)) + ')';
        scRaf = requestAnimationFrame(scFrame);
    }

    function scStartSession() {
        clearTimeout(scSessionTimer);
        var span = SC_SESSION_MS + scLockLeft();   // le decompte part quand l'ecran se debloque
        scSessionEnd = Date.now() + span;
        scSessionTimer = setTimeout(function () { setScannerState('WAITING_VEHICLE'); }, span);
        scTick();
    }

    function scClearLock() {
        scLockTimers.forEach(function (x) { clearTimeout(x); clearInterval(x); });
        scLockTimers = [];
        scLockUntil = 0;
        var el = scEl('scanner-lock');
        if (el) el.className = 'lock';
        var r = scEl('scanner-reader');
        if (r) r.classList.remove('is-busy');
    }

    function startScannerLock() {
        var el = scEl('scanner-lock');
        if (!el) return;
        scLockTimers.forEach(function (x) { clearTimeout(x); clearInterval(x); });
        scLockTimers = [];

        var startedAt = Date.now();
        scLockUntil = startedAt + SC_LOCK_MS + SC_READY_MS;
        el.className = 'lock is-on';
        scEl('scanner-lock-title').textContent = 'Un instant\u2026';
        scEl('scanner-lock-sub').textContent = 'Ne repasse pas ta carte tout de suite';
        var reader = scEl('scanner-reader');
        if (reader) reader.classList.add('is-busy');

        function paint() {
            var left = Math.max(0, SC_LOCK_MS - (Date.now() - startedAt));
            var c = scEl('scanner-lock-count');
            if (c) c.textContent = Math.ceil(left / 1000);
            var f = scEl('scanner-lock-fill');
            if (f) f.style.strokeDashoffset = SC_RING * (1 - left / SC_LOCK_MS);
        }
        paint();
        scLockTimers.push(setInterval(paint, 100));

        scLockTimers.push(setTimeout(function () {
            el.className = 'lock is-on is-ready';
            scEl('scanner-lock-title').textContent = 'Tu peux repasser ta carte';
            scEl('scanner-lock-sub').textContent = '';
            if (reader) reader.classList.remove('is-busy');
            scLockTimers.push(setTimeout(function () { el.className = 'lock'; }, SC_READY_MS));
        }, SC_LOCK_MS));
    }

    // Confirmation plein ecran : la barre ne part qu'une fois l'ecran debloque
    function scFlash(f) {
        clearTimeout(scSessionTimer);
        clearTimeout(scFlashTimer);
        scSessionEnd = 0;
        scFlashOn = true;
        var el = scEl('scanner-flash');
        el.className = 'flash flash--' + f.kind;
        var wait = scLockLeft();
        el.style.setProperty('--dur', SC_FLASH_MS + 'ms');
        el.style.setProperty('--delay', wait + 'ms');
        el.innerHTML =
            '<div class="flash__box">' +
                '<div class="flash__icon">' + scSvgDraw(SC_FLASH_ICON[f.kind]) + '</div>' +
                (f.kicker ? '<div class="flash__kicker">' + f.kicker + '</div>' : '') +
                '<div class="flash__title">' + f.title + '</div>' +
                (f.sub ? '<div class="flash__sub">' + f.sub + '</div>' : '') +
                (f.meta ? '<div class="flash__meta">' + f.meta.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' : '') +
                (f.next ? '<div class="flash__next">' + scSvg('arrow') + f.next + '</div>' : '') +
            '</div>' +
            '<div class="flash__bar"></div>';
        void el.offsetWidth;
        el.classList.add('is-on');
        scFlashTimer = setTimeout(scEndFlash, SC_FLASH_MS + wait);
    }

    function scEndFlash(goIdle) {
        clearTimeout(scFlashTimer);
        if (!scFlashOn) return;
        scFlashOn = false;
        var el = scEl('scanner-flash');
        if (el) el.classList.remove('is-on');
        if (goIdle === true || !scannerEmployee) setScannerState('WAITING_VEHICLE');
        else scStartSession();
    }

    function openScanner() {
        var overlay = document.getElementById('nfc-scanner-overlay');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        fitScannerScreen();
        window.addEventListener('resize', fitScannerScreen);
        setScannerState('WAITING_VEHICLE');
        scTick();
        clearInterval(scClockTimer);
        scClockTimer = setInterval(scTick, 1000);
        cancelAnimationFrame(scRaf);
        scRaf = requestAnimationFrame(scFrame);
        startNfcListener();
    }

    function closeScanner() {
        var overlay = document.getElementById('nfc-scanner-overlay');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        window.removeEventListener('resize', fitScannerScreen);
        stopNfcListener();
        clearScannerTimers();
        scClearLock();
        clearInterval(scClockTimer);
        cancelAnimationFrame(scRaf);
        scRaf = 0;
        scEndFlash(true);
        scFlashOn = false;
        scannerState = null;
        scannerVehicle = null;
        scannerActiveOrder = null;
        scannerEmployee = null;
        scannerArmed = false;
    }

    function clearScannerTimers() {
        if (scannerInterval) { clearInterval(scannerInterval); scannerInterval = null; }
        if (scannerTimeout) { clearTimeout(scannerTimeout); scannerTimeout = null; }
        clearTimeout(scSessionTimer);
        scSessionEnd = 0;
    }

    function setScannerState(state) {
        clearScannerTimers();
        scannerState = state;

        if (state === 'WAITING_VEHICLE') {
            scannerVehicle = null;
            scannerEmployee = null;
            scannerArmed = false;
            scSessionEnd = 0;
            scSetView('idle');

        } else if (state === 'EMPLOYEE_PROFILE') {
            scRenderEmployee();
            scSetView('employee');
            scStartSession();

        } else if (state === 'WAITING_EMPLOYEE') {
            scRenderVehicle();
            scSetView('vehicle');
            scStartSession();
        }
    }

    // Profil employe : une seule tuile s'il est OUT, deux s'il est IN
    function scRenderEmployee() {
        var e = scannerEmployee;
        var open = e.open_jobs || [];
        var vehTile = '', badgeTile;

        if (!e.is_in) {
            badgeTile = scTile({ primary: true, tone: 'green', icon: 'badge', step: 'Repasse ton badge', action: 'Punch IN', desc: 'pour commencer ta journ\u00e9e.' });
        } else {
            vehTile = scTile({ primary: true, tone: 'orange', icon: 'car', step: 'Passe un v\u00e9hicule',
                action: open.length ? 'Ouvrir ou fermer' : 'Commencer une job',
                desc: open.length ? 'Ou passe un de tes v\u00e9hicules en cours pour terminer sa job.' : 'Le chrono part d\u00e8s que le v\u00e9hicule est scann\u00e9.' });
            badgeTile = open.length
                ? scTile({ locked: true, icon: 'badge', step: 'Repasse ton badge', action: 'Punch OUT',
                    lock: open.length === 1 ? 'Ferme ta job d\u2019abord' : 'Ferme tes ' + open.length + ' jobs d\u2019abord' })
                : scTile({ primary: true, tone: 'blue', icon: 'badge', step: 'Repasse ton badge', action: 'Punch OUT', desc: 'pour terminer ta journ\u00e9e.' });
        }

        var jobsHtml = '';
        if (open.length) {
            var shown = open.slice(0, 4), more = open.length - shown.length;
            var cards = shown.map(function (j) {
                var v = j.vehicle || {};
                var sub = [v.plate, 'depuis ' + scHM(j.started_at)].filter(Boolean).join(' \u00b7 ');
                return '<div class="ejob">' +
                    '<div class="job__icon">' + scSvg('car') + '</div>' +
                    '<div class="ejob__info"><div class="ejob__veh">' + escHtml(scVehName(v)) + (v.year ? ' <span>' + v.year + '</span>' : '') + '</div>' +
                    '<div class="ejob__sub">' + escHtml(sub) + '</div></div>' +
                    '<span class="ejob__timer" data-since="' + j.started_at + '">' + scTimerText(j.started_at) + '</span>' +
                '</div>';
            }).join('');
            var moreCard = more > 0 ? '<div class="ejob ejob--more">+' + more + ' autre' + (more > 1 ? 's' : '') + ' job' + (more > 1 ? 's' : '') + ' ouverte' + (more > 1 ? 's' : '') + '</div>' : '';
            jobsHtml = '<div class="emp__jobs">' +
                '<div class="section-title">Tes jobs ouvertes <span class="pill">' + open.length + '</span></div>' +
                '<div class="ejobs">' + cards + moreCard + '</div>' +
            '</div>';
        }

        scEl('scanner-view-employee').innerHTML =
            '<div class="emp">' +
                '<div class="emp__head">' + scAvatar(e, 'avatar--xl', e.is_in) +
                    '<div class="emp__who">' +
                        '<div class="emp__name">' + escHtml(scName(e)) + '</div>' +
                        '<div class="emp__status">' + (e.is_in
                            ? '<span class="status status--in"><i></i>IN</span><span>depuis ' + scHM(e.open_punch && e.open_punch.punch_in) + '</span>'
                            : '<span class="status status--out"><i></i>OUT</span><span>Pas encore de punch aujourd\u2019hui</span>') + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="tiles ' + (e.is_in ? 'tiles--in' : 'tiles--single') + '">' + vehTile + badgeTile + '</div>' +
                jobsHtml +
            '</div>';
    }

    // Vehicule scanne en premier
    function scRenderVehicle() {
        var v = scannerVehicle;
        var open = scannerVehicleOrders || [];
        var shown = open.slice(0, 3), more = open.length - shown.length;
        var working = open.length
            ? '<span>En ce moment :</span>' + shown.map(function (o) {
                var e = o.employee || {};
                return '<span class="who">' + scAvatar(e, 'avatar--sm', true) + escHtml(((e.first_name || '') + ' ' + (e.last_name || '').charAt(0) + '.').trim()) +
                    '<b data-since="' + o.started_at + '">' + scTimerText(o.started_at) + '</b></span>';
            }).join('') + (more > 0 ? '<span class="who who--more">+' + more + ' autre' + (more > 1 ? 's' : '') + '</span>' : '')
            : '<span>Personne ne travaille sur ce v\u00e9hicule en ce moment.</span>';

        var plateChip = v.plate ? '<span class="chip chip--plate">' + scSvg('plate') + '<b>' + escHtml(v.plate) + '</b></span>' : '';
        var ownerChip = v.owner_name ? '<span class="chip">' + scSvg('user') + escHtml(v.owner_name) + '</span>' : '';

        scEl('scanner-view-vehicle').innerHTML =
            '<div class="veh">' +
                '<div class="vcard">' +
                    '<div class="vcard__art" style="--swatch:hsl(' + scHue(v.id) + ',38%,32%)">' + scSvg('carFront') + '</div>' +
                    '<div class="vcard__body">' +
                        '<div class="vcard__name">' + escHtml(scVehName(v)) + (v.year ? ' <small>' + v.year + '</small>' : '') + '</div>' +
                        '<div class="vcard__chips">' + plateChip + ownerChip + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="veh__now">' + working + '</div>' +
                '<div class="veh__cta">' + scTapper('tapper--sm') +
                    '<div class="veh__title">Passe ton badge</div>' +
                    '<div class="veh__sub">' + (open.length ? 'pour commencer une job, ou terminer la tienne si tu es d\u00e9j\u00e0 dessus' : 'pour commencer une job sur ce v\u00e9hicule') + '</div>' +
                '</div>' +
            '</div>';
    }

    function startNfcListener() {
        // Le WebSocket ecoute globalement : rien a faire ici
    }

    function stopNfcListener() {
        // Le WebSocket ecoute globalement : rien a faire ici
    }

    // Le badge d'un employe, enrichi de son statut de punch et de ses jobs ouvertes
    async function loadEmployeeState(employee) {
        var rows = await api('GET', '/api/control-punches?today=true');
        var mine = (rows || []).find(function (r) { return r.id === employee.id; });
        var jobs = [];
        if (mine && mine.open_jobs && mine.open_jobs.length) {
            try {
                var active = await api('GET', '/api/control-work-orders?active=true');
                jobs = (active || []).filter(function (o) { return o.employee_id === employee.id; });
            } catch (e) { jobs = mine.open_jobs; }
        }
        return Object.assign({}, employee, {
            is_in: mine ? mine.is_in : false,
            open_punch: mine ? mine.open_punch : null,
            open_jobs: jobs
        });
    }

    async function togglePunch(emp) {
        var action = emp.is_in ? 'out' : 'in';
        try {
            await api('POST', '/api/control-punches', { employee_id: emp.id, action: action });
            scFlash(action === 'in'
                ? { kind: 'in', kicker: escHtml(scName(emp)), title: 'Punch IN', sub: 'Bonne journ\u00e9e !', meta: ['Arriv\u00e9e \u00e0 ' + scHM(new Date().toISOString())] }
                : { kind: 'out', kicker: escHtml(scName(emp)), title: 'Punch OUT', sub: 'Bonne fin de journ\u00e9e !', meta: ['D\u00e9part \u00e0 ' + scHM(new Date().toISOString())] });
            scannerEmployee = null;
        } catch (err) {
            if (/open_jobs|Open work orders/.test(err.message)) {
                scFlash({ kind: 'block', title: 'Punch OUT bloqu\u00e9', sub: 'Tu as encore une job ouverte.', next: 'Passe le v\u00e9hicule pour la fermer, puis repasse ton badge.' });
            } else if (/too_soon|Just punched IN/.test(err.message)) {
                scFlash({ kind: 'block', title: 'Tu viens de puncher IN', sub: 'Attends une minute avant de puncher OUT.' });
            } else {
                scFlash({ kind: 'block', title: 'Impossible', sub: escHtml(err.message) });
            }
        }
    }

    async function handleNfcScan(tagId) {
        if (!scannerState) return;

        // Carte laissee sur le lecteur ou repassee trop vite : on ignore
        if (scLockLeft() > 0) return;
        startScannerLock();

        var reader = scEl('scanner-reader');
        if (reader) { reader.classList.remove('is-reading'); void reader.offsetWidth; reader.classList.add('is-reading'); }

        // Une confirmation en cours est coupee par un nouveau scan
        if (scFlashOn) { scFlashOn = false; var fl = scEl('scanner-flash'); if (fl) fl.classList.remove('is-on'); clearTimeout(scFlashTimer); }

        if (scannerState === 'WAITING_VEHICLE') {
            await handleNfcScanFromIdle(tagId);

        } else if (scannerState === 'EMPLOYEE_PROFILE' && scannerEmployee) {
            var again = null;
            try { again = await api('GET', '/api/control-employees?nfc=' + encodeURIComponent(tagId)); } catch (e) { again = null; }

            // Le meme badge une 2e fois : on change son statut IN/OUT
            if (again && scannerArmed && again.id === scannerEmployee.id) { await togglePunch(scannerEmployee); return; }
            if (again) { scannerEmployee = await loadEmployeeState(again); scannerArmed = true; setScannerState('EMPLOYEE_PROFILE'); return; }

            var veh = null;
            try { veh = await api('GET', '/api/control-vehicles?nfc=' + encodeURIComponent(tagId)); } catch (e) { veh = null; }
            if (!veh) { scFlash({ kind: 'unknown', title: 'Badge inconnu', sub: 'Cette carte n\u2019est associ\u00e9e \u00e0 personne ni \u00e0 aucun v\u00e9hicule.' }); return; }

            if (!scannerEmployee.is_in) {
                scFlash({ kind: 'block', title: 'Punch IN d\u2019abord', sub: 'Tu dois commencer ta journ\u00e9e avant d\u2019ouvrir une job.', next: 'Repasse ton badge pour puncher IN.' });
                return;
            }
            await scJobOnVehicle(veh, scannerEmployee);

        } else if (scannerState === 'WAITING_EMPLOYEE' && scannerVehicle) {
            var employee = null;
            try { employee = await api('GET', '/api/control-employees?nfc=' + encodeURIComponent(tagId)); } catch (e) { employee = null; }
            if (!employee) { scFlash({ kind: 'unknown', title: 'Badge inconnu', sub: 'Cette carte n\u2019est associ\u00e9e \u00e0 personne.' }); return; }

            var st = await loadEmployeeState(employee);
            var mineOpen = (scannerVehicleOrders || []).some(function (o) { return o.employee_id === employee.id; });
            if (!mineOpen && !st.is_in) {
                scFlash({ kind: 'block', title: 'Punch IN d\u2019abord', sub: 'Tu dois commencer ta journ\u00e9e avant d\u2019ouvrir une job.', next: 'Passe ton badge seul pour puncher IN.' });
                return;
            }
            await scJobOnVehicle(scannerVehicle, st);

        } else {
            // Session deja retombee (une confirmation venait de s'afficher) : on repart de l'accueil
            scannerState = 'WAITING_VEHICLE';
            scannerEmployee = null;
            scannerVehicle = null;
            scannerArmed = false;
            await handleNfcScanFromIdle(tagId);
        }
    }

    // Traitement d'un scan quand aucune session n'est ouverte
    async function handleNfcScanFromIdle(tagId) {
        var vehicle = null;
        try { vehicle = await api('GET', '/api/control-vehicles?nfc=' + encodeURIComponent(tagId)); } catch (e) { vehicle = null; }

        if (vehicle) {
            scannerVehicle = vehicle;
            try { scannerVehicleOrders = await api('GET', '/api/control-work-orders?vehicle_id=' + vehicle.id); } catch (e) { scannerVehicleOrders = []; }
            setScannerState('WAITING_EMPLOYEE');
            return;
        }

        var emp = null;
        try { emp = await api('GET', '/api/control-employees?nfc=' + encodeURIComponent(tagId)); } catch (e) { emp = null; }
        if (!emp) { scFlash({ kind: 'unknown', title: 'Badge inconnu', sub: 'Cette carte n\u2019est associ\u00e9e \u00e0 personne ni \u00e0 aucun v\u00e9hicule.' }); return; }

        scannerEmployee = await loadEmployeeState(emp);
        scannerArmed = true;
        setScannerState('EMPLOYEE_PROFILE');
    }

    // Ouvre ou ferme la job de cet employe sur ce vehicule
    async function scJobOnVehicle(veh, emp) {
        try {
            var orders = await api('GET', '/api/control-work-orders?vehicle_id=' + veh.id);
            var mineOrder = orders && orders.length ? orders.find(function (o) { return o.employee_id === emp.id; }) : null;
            if (mineOrder) {
                await api('PATCH', '/api/control-work-orders', { vehicle_id: veh.id, employee_id: emp.id });
                scFlash({ kind: 'jobEnd', kicker: escHtml(scName(emp)), title: 'Job termin\u00e9e', sub: escHtml(scVehLine(veh)), meta: ['Commenc\u00e9e \u00e0 ' + scHM(mineOrder.started_at)] });
            } else {
                await api('POST', '/api/control-work-orders', { vehicle_id: veh.id, employee_id: emp.id, started_at: new Date().toISOString() });
                scFlash({ kind: 'jobStart', kicker: escHtml(scName(emp)), title: 'Job commenc\u00e9e', sub: escHtml(scVehLine(veh)), meta: ['D\u00e9but \u00e0 ' + scHM(new Date().toISOString())] });
            }
            scannerEmployee = null;
        } catch (e) {
            scFlash({ kind: 'block', title: 'Impossible', sub: escHtml(e.message) });
        }
    }

    function showScannerError(msg) {
        scFlash({ kind: 'block', title: 'Impossible', sub: escHtml(msg) });
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

    function getNotifPrefs() {
        try {
            var saved = localStorage.getItem('ea-notif-prefs');
            if (saved) return JSON.parse(saved);
        } catch(e) {}
        return { start: true, end: true, pause: true, resume: true };
    }

    function saveNotifPrefs(prefs) {
        try { localStorage.setItem('ea-notif-prefs', JSON.stringify(prefs)); } catch(e) {}
    }

    function initNotifPrefs() {
        var prefs = getNotifPrefs();
        var types = ['start', 'end', 'pause', 'resume'];
        types.forEach(function(t) {
            var el = document.getElementById('notif-toggle-' + t);
            if (!el) return;
            el.checked = prefs[t] !== false;
            el.addEventListener('change', function() {
                var p = getNotifPrefs();
                p[t] = el.checked;
                saveNotifPrefs(p);
            });
        });
    }

    var lastLoggedNotif = {};

    function logNotificationToServer(type, title, detail) {
        // Deduplicate: skip if same notification was logged within 10 seconds
        var key = type + '|' + title + '|' + (detail || '');
        var now = Date.now();
        if (lastLoggedNotif[key] && now - lastLoggedNotif[key] < 10000) return;
        lastLoggedNotif[key] = now;

        var isSystem = (title && title.indexOf('(sys)') !== -1) || (detail && detail.indexOf('(sys)') !== -1);
        api('POST', '/api/notification-logs', {
            type: type,
            title: title,
            detail: detail || '',
            is_system: isSystem
        }).catch(function() {});
    }

    function addNotification(type, title, detail) {
        // Always log to server, even if user toggle is off
        logNotificationToServer(type, title, detail);
        var prefs = getNotifPrefs();
        if (prefs[type] === false) return;
        notifications.unshift({
            type: type,
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
        if (!badge || !toggle) return;
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
            list.innerHTML = '<div class="control-notif-empty">' + t('notif.empty') + '</div>';
            return;
        }
        var html = '';
        var notifIcons = {
            start: { cls: 'control-notif-item__icon--start', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>' },
            end: { cls: 'control-notif-item__icon--end', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/></svg>' },
            pause: { cls: 'control-notif-item__icon--pause', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' },
            resume: { cls: 'control-notif-item__icon--resume', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>' }
        };
        notifications.forEach(function(n) {
            var icon = notifIcons[n.type] || notifIcons.start;
            var iconClass = icon.cls;
            var iconSvg = icon.svg;
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
        if (seconds < 60) return t('notif.just_now');
        var minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes + t('notif.time_min');
        var hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + t('notif.time_h');
        return Math.floor(hours / 24) + t('notif.time_d');
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

    var notifHistoryOffset = 0;
    var TYPE_LABELS = { start: 'Commencé', end: 'Terminé', pause: 'Pause', resume: 'Repris' };

    function openNotifHistory() {
        var modal = document.getElementById('notif-history-modal');
        if (!modal) return;
        modal.classList.add('active');
        notifHistoryOffset = 0;
        loadNotifHistory(false);
    }

    function closeNotifHistory() {
        var modal = document.getElementById('notif-history-modal');
        if (modal) modal.classList.remove('active');
    }

    async function loadNotifHistory(append) {
        var list = document.getElementById('notif-history-list');
        if (!list) return;
        if (!append) {
            list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px;">Chargement...</div>';
            notifHistoryOffset = 0;
        }
        try {
            var logs = await api('GET', '/api/notification-logs?limit=100&offset=' + notifHistoryOffset);
            if (!append) list.innerHTML = '';
            if ((!logs || logs.length === 0) && notifHistoryOffset === 0) {
                list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px;">Aucune notification enregistrée.</div>';
                return;
            }
            var table = list.querySelector('.notif-history-table');
            var tbody;
            if (!table) {
                table = document.createElement('table');
                table.className = 'notif-history-table';
                table.innerHTML = '<thead><tr><th>Date</th><th>Type</th><th>Titre</th><th>Détail</th></tr></thead><tbody></tbody>';
                list.appendChild(table);
                tbody = table.querySelector('tbody');
            } else {
                tbody = table.querySelector('tbody');
            }
            // Remove old load-more button
            var oldBtn = list.querySelector('.notif-history__load-more');
            if (oldBtn) oldBtn.remove();

            (logs || []).forEach(function(log) {
                var tr = document.createElement('tr');
                var d = new Date(log.created_at);
                var dateStr = d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                var typeLabel = TYPE_LABELS[log.type] || log.type;
                var sysTag = log.is_system ? '<span class="notif-history__sys">(sys)</span>' : '';
                tr.innerHTML = '<td style="white-space:nowrap;color:var(--text-muted);font-size:0.82rem;">' + escHtml(dateStr) + '</td>' +
                    '<td><span class="notif-history__type notif-history__type--' + escHtml(log.type) + '">' + escHtml(typeLabel) + '</span>' + sysTag + '</td>' +
                    '<td>' + escHtml(log.title) + '</td>' +
                    '<td style="color:var(--text-muted);">' + escHtml(log.detail || '') + '</td>';
                tbody.appendChild(tr);
            });

            notifHistoryOffset += (logs || []).length;
            if (logs && logs.length >= 100) {
                var loadMore = document.createElement('div');
                loadMore.className = 'notif-history__load-more';
                loadMore.innerHTML = '<button class="btn btn--ghost btn--sm">Charger plus</button>';
                loadMore.querySelector('button').addEventListener('click', function() { loadNotifHistory(true); });
                list.appendChild(loadMore);
            }
        } catch(e) {
            if (!append) list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px;">Erreur: ' + escHtml(e.message) + '</div>';
        }
    }

    // Poll for work order changes
    function orderLabel(order) {
        var emp = order.employee;
        var veh = order.vehicle;
        var empName = emp ? (emp.first_name + ' ' + emp.last_name) : '?';
        var vehName = veh ? veh.make + (veh.plate ? ' - ' + veh.plate : '') : '?';
        return empName + ' → ' + vehName;
    }

    async function pollWorkOrders() {
        if (!knownOrdersReady) return; // Wait for initial load to finish
        try {
            var active = await api('GET', '/api/control-work-orders?active=true');
            if (!active) return;

            // Check pause boundaries on every poll (not just when monitoring is open)
            checkPauseBoundaries(active);

            var currentIds = {};
            active.forEach(function(o) { currentIds[o.id] = o; });

            var hasChanges = false;

            // Detect new work orders (started)
            active.forEach(function(o) {
                if (!knownOrderIds[o.id]) {
                    addNotification('start', 'Bon de travail commencé', orderLabel(o));
                    hasChanges = true;
                } else {
                    // Detect pause/resume changes
                    var prev = knownOrderIds[o.id];
                    if (!!o.paused !== !!prev.paused) {
                        if (o.paused) {
                            addNotification('pause', 'Bon mis en pause', orderLabel(o));
                        } else {
                            addNotification('resume', 'Bon repris', orderLabel(o));
                        }
                        hasChanges = true;
                    }
                }
            });

            // Detect closed work orders (were known, now gone)
            Object.keys(knownOrderIds).forEach(function(id) {
                if (!currentIds[id]) {
                    var order = knownOrderIds[id];
                    if (order) {
                        addNotification('end', 'Bon de travail terminé', orderLabel(order));
                    }
                    hasChanges = true;
                }
            });

            knownOrderIds = currentIds;

            // Refresh vehicle list, dashboard and monitoring if changes detected
            if (hasChanges) {
                loadVehicles();
                var monPanel = document.getElementById('panel-monitoring');
                if (monPanel && monPanel.classList.contains('active')) loadMonitoring();
            }
        } catch(e) { console.error('pollWorkOrders error:', e); }
    }

    var knownOrdersReady = false;

    function startNotifPolling() {
        if (notifPollingInterval) return;
        // Initial load of known orders (no notification on first load)
        api('GET', '/api/control-work-orders?active=true').then(function(active) {
            if (active) active.forEach(function(o) { knownOrderIds[o.id] = o; });
            knownOrdersReady = true;
        }).catch(function() { knownOrdersReady = true; });
        // Poll every 5 seconds
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

    // Days left before an unassigned media is auto-deleted (0..10).
    // Based on expires_at (Québec-midnight boundary), so it steps down at midnight.
    function mediaDaysLeft(expiresAt) {
        if (!expiresAt) return null;
        var diff = new Date(expiresAt).getTime() - Date.now();
        var days = Math.ceil(diff / 86400000);
        if (days < 0) days = 0;
        return days;
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

        // Expiry pastille — only on unassigned media (expires_at set by the DB).
        var daysLeft = mediaDaysLeft(m.expires_at);
        if (daysLeft !== null) {
            var urgent = daysLeft <= 3;
            inner += '<div class="media-thumb__expiry' + (urgent ? ' media-thumb__expiry--urgent' : '') +
                '" title="Sera supprimée automatiquement dans ' + daysLeft + ' jour' + (daysLeft > 1 ? 's' : '') +
                ' si elle n\'est pas classée">' + daysLeft + ' j</div>';
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

    async function loadMedias(forceRender) {
        var gridNew = document.getElementById('media-grid-new');
        var groupsEl = document.getElementById('media-assigned-groups');
        if (!gridNew) return;
        var isFirstLoad = !lastMediaSignature;
        if (isFirstLoad) {
            gridNew.innerHTML = '<div class="media-empty-state">Chargement...</div>';
            if (groupsEl) groupsEl.innerHTML = '';
        }
        try {
            var results = await Promise.all([
                api('GET', '/api/media?filter=unassigned'),
                api('GET', '/api/media?filter=assigned')
            ]);
            var unassigned = results[0] || [];
            var assigned = results[1] || [];

            // Check if data changed — skip re-render if identical
            var sig = unassigned.map(function(m) { return m.id + ':' + (m.vehicle_id || ''); }).join(',')
                + '|' + assigned.map(function(m) { return m.id + ':' + (m.vehicle_id || ''); }).join(',');
            if (!forceRender && sig === lastMediaSignature) return;
            lastMediaSignature = sig;

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
                html += '<div class="media-group__title"><a href="#" onclick="event.preventDefault();Control.openVehicleDetail(\'' + escHtml(vid) + '\')" style="color:var(--accent);text-decoration:none;">' + label + '</a> <span class="media-badge">' + g.items.length + '</span></div>';
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

    function vehLabel(v) {
        return (v.make || '') + (v.model ? ' ' + v.model : '') + (v.year ? ' ' + v.year : '') + (v.plate ? ' - ' + v.plate : '') + ' (' + (v.owner_name || '') + ')';
    }

    function initVehSearchSelect() {
        var input = document.getElementById('media-classify-vehicle-input');
        var hidden = document.getElementById('media-classify-vehicle');
        var dropdown = document.getElementById('media-classify-vehicle-dropdown');
        if (!input || !dropdown) return;

        var sorted = allVehicles.slice().sort(function(a, b) {
            var la = (a.make || '').toLowerCase();
            var lb = (b.make || '').toLowerCase();
            return la < lb ? -1 : la > lb ? 1 : 0;
        });

        function renderList(query) {
            var q = (query || '').toLowerCase();
            var matches = sorted.filter(function(v) {
                return vehLabel(v).toLowerCase().indexOf(q) !== -1;
            });
            if (matches.length === 0) {
                dropdown.innerHTML = '<div class="veh-search-select__empty">Aucun résultat</div>';
            } else {
                dropdown.innerHTML = matches.map(function(v) {
                    return '<div class="veh-search-select__item" data-id="' + escHtml(v.id) + '">' + escHtml(vehLabel(v)) + '</div>';
                }).join('');
            }
            dropdown.classList.add('veh-search-select__dropdown--open');
        }

        input.addEventListener('focus', function() { renderList(input.value); });
        input.addEventListener('input', function() {
            hidden.value = '';
            renderList(input.value);
        });
        dropdown.addEventListener('mousedown', function(e) {
            var item = e.target.closest('.veh-search-select__item');
            if (item) {
                hidden.value = item.getAttribute('data-id');
                input.value = item.textContent;
                dropdown.classList.remove('veh-search-select__dropdown--open');
            }
        });
        input.addEventListener('blur', function() {
            setTimeout(function() { dropdown.classList.remove('veh-search-select__dropdown--open'); }, 150);
        });
    }

    function enterClassifyMode() {
        mediaClassifyMode = true;
        selectedMediaIds = {};
        setMediaModeBtns(false);
        var bar = document.getElementById('media-classify-bar');
        if (bar) bar.style.display = 'flex';
        var input = document.getElementById('media-classify-vehicle-input');
        var hidden = document.getElementById('media-classify-vehicle');
        if (input) input.value = '';
        if (hidden) hidden.value = '';
        initVehSearchSelect();
        loadMedias(true);
    }

    function exitClassifyMode() {
        mediaClassifyMode = false;
        selectedMediaIds = {};
        setMediaModeBtns(true);
        var bar = document.getElementById('media-classify-bar');
        if (bar) bar.style.display = 'none';
        loadMedias(true);
    }

    function enterDeleteMode() {
        mediaDeleteMode = true;
        selectedMediaIds = {};
        setMediaModeBtns(false);
        var bar = document.getElementById('media-delete-bar');
        if (bar) bar.style.display = 'flex';
        loadMedias(true);
    }

    function exitDeleteMode() {
        mediaDeleteMode = false;
        selectedMediaIds = {};
        setMediaModeBtns(true);
        var bar = document.getElementById('media-delete-bar');
        if (bar) bar.style.display = 'none';
        loadMedias(true);
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
    var lastMediaSignature = '';
    var monitoringPauseOverrides = {};
    var monitoringPauseAtOverrides = {};
    var monitoringLoadingOrders = {};
    var lastPauseCheckTime = null;
    var lastPauseCheckDay = null;

    function isInWorkPeriod(day, minutes) {
        var bounds = PAUSE_BOUNDS[day] || [];
        for (var i = 0; i < bounds.length; i += 2) {
            var start = bounds[i];
            var end = bounds[i + 1] !== undefined ? bounds[i + 1] : 1440;
            if (minutes >= start && minutes < end) return true;
        }
        return false;
    }

    function applyPauseState(activeOrders, shouldRun) {
        var changed = false;
        activeOrders.forEach(function(o) {
            if (shouldRun && o.paused) {
                // Only auto-resume orders that the system itself paused.
                // A manual pause is the user's intent — never undo it.
                if (o.pause_source !== 'scheduled') return;
                monitoringLoadingOrders[o.id] = true;
                var strip = document.getElementById('monitoring-action-' + o.id);
                if (strip) strip.innerHTML = '<span class="timer-loader"></span>';
                api('PATCH', '/api/control-work-orders', { action: 'resume', id: o.id, source: 'scheduled' });
                addNotification('resume', 'Bon repris (sys)', orderLabel(o));
                if (knownOrderIds[o.id]) knownOrderIds[o.id].paused = false;
                changed = true;
            } else if (!shouldRun && !o.paused) {
                monitoringPauseOverrides[o.id] = true;
                monitoringPauseAtOverrides[o.id] = Date.now();
                var strip = document.getElementById('monitoring-action-' + o.id);
                if (strip) strip.innerHTML = '<span class="timer-loader"></span>';
                api('PATCH', '/api/control-work-orders', { action: 'pause', id: o.id, source: 'scheduled' });
                addNotification('pause', 'Bon mis en pause (sys)', orderLabel(o));
                if (knownOrderIds[o.id]) {
                    knownOrderIds[o.id].paused = true;
                    knownOrderIds[o.id].pause_source = 'scheduled';
                }
                changed = true;
            }
        });
        if (changed) {
            setTimeout(function() { loadMonitoring(); }, 500);
        }
    }

    function checkPauseBoundaries(activeOrders) {
        var et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
        var day = et.getDay();
        var t = et.getHours() * 60 + et.getMinutes();
        var bounds = PAUSE_BOUNDS[day] || [];

        if (lastPauseCheckTime === null || lastPauseCheckDay !== day) {
            lastPauseCheckTime = t;
            lastPauseCheckDay = day;
            // Retroactive check: apply correct state based on current time
            if (bounds.length > 0) {
                applyPauseState(activeOrders, isInWorkPeriod(day, t));
            }
            return;
        }

        var prev = lastPauseCheckTime;
        lastPauseCheckTime = t;
        lastPauseCheckDay = day;

        for (var i = 0; i < bounds.length; i++) {
            if (prev < bounds[i] && t >= bounds[i]) {
                applyPauseState(activeOrders, i % 2 === 0);
                break;
            }
        }
    }

    function toggleOrderPause(orderId, index) {
        var el = document.getElementById('monitoring-timer-' + index);
        var card = el ? el.closest('.monitoring-order') : null;
        var dot = card ? card.querySelector('.monitoring-order__dot') : null;
        var strip = document.getElementById('monitoring-action-' + orderId);
        var currentlyPaused = card && card.classList.contains('monitoring-order--paused');
        var newPaused = !currentlyPaused;

        // Optimistic UI: flip pause/play state immediately so the user sees feedback now.
        if (newPaused) {
            monitoringPauseOverrides[orderId] = true;
            monitoringPauseAtOverrides[orderId] = Date.now();
            if (card) card.classList.add('monitoring-order--paused');
            if (el) el.classList.add('monitoring-order__timer--paused');
            if (dot) dot.classList.add('monitoring-order__dot--paused');
        } else {
            monitoringPauseOverrides[orderId] = false;
            delete monitoringPauseAtOverrides[orderId];
            monitoringLoadingOrders[orderId] = true;
            if (card) card.classList.remove('monitoring-order--paused');
            if (el) el.classList.remove('monitoring-order__timer--paused');
            if (dot) dot.classList.remove('monitoring-order__dot--paused');
        }
        if (strip) strip.innerHTML = '<span class="timer-loader"></span>';

        var action = newPaused ? 'pause' : 'resume';
        api('PATCH', '/api/control-work-orders', { action: action, id: orderId, source: 'manual' })
            .then(function() { loadMonitoring(); })
            .catch(function(err) {
                // Rollback the optimistic change.
                monitoringPauseOverrides[orderId] = currentlyPaused;
                if (currentlyPaused) {
                    if (card) card.classList.add('monitoring-order--paused');
                    if (el) el.classList.add('monitoring-order__timer--paused');
                    if (dot) dot.classList.add('monitoring-order__dot--paused');
                } else {
                    if (card) card.classList.remove('monitoring-order--paused');
                    if (el) el.classList.remove('monitoring-order__timer--paused');
                    if (dot) dot.classList.remove('monitoring-order__dot--paused');
                }
                showToast('error', 'Erreur', 'Impossible de mettre à jour la pause: ' + (err && err.message ? err.message : 'erreur réseau'));
                loadMonitoring();
            });
    }

    function toggleVehiclePause(orderId, vehicleId) {
        var veh = allVehicles.find(function(v) { return v.id === vehicleId; });
        var aos = veh ? (veh.active_orders || []) : [];
        var ao = aos.find(function(o) { return o.id === orderId; });
        if (!ao) return;
        var currentlyPaused = !!ao.paused;
        var newPaused = !currentlyPaused;

        // Optimistic local-state update so the next render reflects the new state instantly.
        var prevState = {
            paused: ao.paused,
            paused_at: ao.paused_at,
            pause_source: ao.pause_source,
            total_paused_seconds: ao.total_paused_seconds
        };
        if (newPaused) {
            ao.paused = true;
            ao.paused_at = new Date().toISOString();
            ao.pause_source = 'manual';
        } else {
            // Compute resumed total_paused_seconds locally so the timer doesn't jump.
            var pausedDelta = ao.paused_at
                ? Math.max(0, Math.round((Date.now() - new Date(ao.paused_at).getTime()) / 1000))
                : 0;
            ao.paused = false;
            ao.paused_at = null;
            ao.pause_source = null;
            ao.total_paused_seconds = (ao.total_paused_seconds || 0) + pausedDelta;
        }
        renderVehicles();

        var action = newPaused ? 'pause' : 'resume';
        api('PATCH', '/api/control-work-orders', { action: action, id: orderId, source: 'manual' })
            .then(function() {
                loadVehicles();
                var monPanel = document.getElementById('panel-monitoring');
                if (monPanel && monPanel.classList.contains('active')) loadMonitoring();
            })
            .catch(function(err) {
                ao.paused = prevState.paused;
                ao.paused_at = prevState.paused_at;
                ao.pause_source = prevState.pause_source;
                ao.total_paused_seconds = prevState.total_paused_seconds;
                renderVehicles();
                showToast('error', 'Erreur', 'Impossible de mettre à jour la pause: ' + (err && err.message ? err.message : 'erreur réseau'));
            });
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

    function stopWorkOrderById(orderId) {
        showConfirmDelete('Arrêter le bon de travail ?', 'Le chrono sera arrêté et le bon de travail sera fermé.', async function() {
            try {
                await api('PATCH', '/api/control-work-orders', { id: orderId });
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
                    '<div><div class="monitoring-card__value">' + employees.length + '</div><div class="monitoring-card__label">' + t('mon.employees_card') + '</div></div>' +
                '</div>' +
                '<div class="monitoring-card">' +
                    '<div class="monitoring-card__icon monitoring-card__icon--vehicles"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9"/></svg></div>' +
                    '<div><div class="monitoring-card__value">' + vehicles.length + '</div><div class="monitoring-card__label">' + t('mon.vehicles_card') + '</div></div>' +
                '</div>' +
                '<div class="monitoring-card">' +
                    '<div class="monitoring-card__icon monitoring-card__icon--active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>' +
                    '<div><div class="monitoring-card__value">' + activeOrders.length + '</div><div class="monitoring-card__label">' + t('mon.active_orders_card') + '</div></div>' +
                '</div>' +
                '<div class="monitoring-card">' +
                    '<div class="monitoring-card__icon monitoring-card__icon--total"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>' +
                    '<div><div class="monitoring-card__value">' + completedToday + '</div><div class="monitoring-card__label">' + t('mon.completed_today') + '</div></div>' +
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
                activeEl.innerHTML = '<div class="monitoring-empty">' + t('mon.no_active') + '</div>';
            } else {
                var html = '';
                activeOrders.forEach(function(o, i) {
                    var vehName = o.vehicle ? (escHtml(o.vehicle.make) + (o.vehicle.model ? ' ' + escHtml(o.vehicle.model) : '') + (o.vehicle.year ? ' - ' + o.vehicle.year : '')) : 'Véhicule';
                    var plate = o.vehicle && o.vehicle.plate ? escHtml(o.vehicle.plate) : '';
                    var empName = o.employee ? escHtml(o.employee.first_name + ' ' + o.employee.last_name) : t('mon.unknown');
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
                        '<span class="monitoring-status-strip" id="monitoring-action-' + o.id + '" onclick="Control.toggleOrderPause(\'' + o.id + '\',' + i + ')">' +
                            '<span class="monitoring-status-strip__play">▶</span>' +
                            '<span class="monitoring-status-strip__pause">⏸</span>' +
                        '</span>' +
                    '</div>';
                });
                activeEl.innerHTML = html;
                checkPauseBoundaries(activeOrders);

                // Start live timers (clear local overrides — server data is authoritative)
                monitoringPauseOverrides = {};
                monitoringPauseAtOverrides = {};
                monitoringLoadingOrders = {};
                activeOrders.forEach(function(o, i) {
                    var el = document.getElementById('monitoring-timer-' + i);
                    if (!el) return;
                    var card = el.closest('.monitoring-order');
                    var dot = card ? card.querySelector('.monitoring-order__dot') : null;
                    var start = new Date(o.started_at).getTime();
                    if (start > Date.now()) start = Date.now();
                    var wasPaused = null;
                    var pausedAtMs = o.paused_at ? new Date(o.paused_at).getTime() : null;
                    var totalPausedSec = o.total_paused_seconds || 0;
                    function tick() {
                        if (monitoringLoadingOrders[o.id]) return;
                        var now = Date.now();
                        var paused = monitoringPauseOverrides[o.id] !== undefined
                            ? monitoringPauseOverrides[o.id] : !!o.paused;
                        var localPausedAt = monitoringPauseAtOverrides[o.id];
                        var endTime = paused ? (localPausedAt || pausedAtMs || now) : now;
                        var secs = Math.max(0, elapsedSeconds(start, endTime) - totalPausedSec);
                        el.textContent = formatDurationLong(secs);
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
                recentEl.innerHTML = '<div class="monitoring-empty">' + t('mon.no_recent') + '</div>';
            } else {
                var rHtml = '';
                completed.slice(0, 20).forEach(function(o) {
                    var vehName = o.vehicle ? (escHtml(o.vehicle.make) + (o.vehicle.year ? ' ' + o.vehicle.year : '')) : t('mon.vehicle_default');
                    var empName = o.employee ? escHtml(o.employee.first_name + ' ' + o.employee.last_name) : t('mon.unknown');
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
            statsEl.innerHTML = '<div class="monitoring-empty">' + t('general.error_prefix') + escHtml(e.message) + '</div>';
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
        initNotifPrefs();
        document.getElementById('notif-toggle').addEventListener('click', toggleNotifPanel);
        document.getElementById('notif-clear').addEventListener('click', clearNotifications);

        // Notification history
        var btnHistory = document.getElementById('btn-notif-history');
        if (btnHistory) btnHistory.addEventListener('click', openNotifHistory);
        var btnHistoryClose = document.getElementById('notif-history-close');
        if (btnHistoryClose) btnHistoryClose.addEventListener('click', closeNotifHistory);

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
                    showToast('warning', t('nfc.badge_assigned_title'), conflict);
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
                        showToast('warning', t('nfc.action_impossible'), t('nfc.emp_has_open_order'));
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
                document.getElementById('emp-stats-month').value = '';
                loadEmployeeStats(btn.getAttribute('data-period'));
            });
        });
        document.getElementById('emp-stats-month').addEventListener('change', function() {
            var val = this.value;
            if (!val) return;
            document.querySelectorAll('#emp-stats-periods .period-btn').forEach(function(b) { b.classList.remove('active'); });
            loadEmployeeStats('month:' + val);
        });

        // Billed hours modal
        var bhModal = document.getElementById('billed-hours-modal');
        document.getElementById('billed-hours-close').addEventListener('click', function() { bhModal.classList.remove('active'); });
        document.getElementById('bh-save').addEventListener('click', saveBilledHour);
        document.getElementById('bh-cancel').addEventListener('click', cancelBilledEdit);

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
                    showToast('warning', t('nfc.badge_assigned_title'), conflict);
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
                    if (active && active.length > 0) {
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

        // Auto-init if control tab was already activated before this script loaded
        // Only if user is authenticated (dashboard visible = session restored)
        if (!window._controlInitDone) {
            var dashboard = document.getElementById('dashboard');
            var controlTab = document.getElementById('tab-control');
            if (dashboard && dashboard.style.display !== 'none' && controlTab && controlTab.classList.contains('active')) {
                window._controlInitDone = true;
                initControl();
            }
        }
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
        openBilledHours: openBilledHours,
        editBilledHour: editBilledHour,
        deleteBilledHour: deleteBilledHour,
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
        toggleMediaSelect: toggleMediaSelect,
        copyMediaLink: function(token) { copyToClipboard(mediaShareUrl(token)); },
        openMediaFull: openMediaFull,
        unassignMedia: function(id) { unassignMedia(id); },
        stopWorkOrder: stopWorkOrder,
        stopWorkOrderById: stopWorkOrderById,
        toggleOrderPause: toggleOrderPause,
        toggleVehiclePause: toggleVehiclePause
    };

})();
