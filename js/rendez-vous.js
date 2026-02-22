// ============================================
// ELECTRAUTO — Appointment Page JavaScript
// ============================================

(function() {

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

        // Update wait time display if visible
        updateWaitTimeText();
    };

    try {
        if (localStorage.getItem('electrauto-lang') === 'en') setLang('en');
    } catch(e) {}

    // ---- Theme Toggle ----
    var themeBtn = document.getElementById('theme-toggle');

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem('electrauto-theme', theme); } catch(e) {}
    }

    try {
        var savedTheme = localStorage.getItem('electrauto-theme');
        if (savedTheme) setTheme(savedTheme);
    } catch(e) {}

    if (themeBtn) {
        themeBtn.addEventListener('click', function() {
            var current = document.documentElement.getAttribute('data-theme');
            setTheme(current === 'light' ? 'dark' : 'light');
        });
    }

    // ---- Navbar scroll ----
    var nav = document.getElementById('nav');
    window.addEventListener('scroll', function() {
        nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });

    // ---- Hamburger ----
    var burger = document.getElementById('burger');
    var links = document.getElementById('nav-links');

    burger.addEventListener('click', function() {
        var open = links.classList.toggle('open');
        burger.classList.toggle('active', open);
    });

    links.querySelectorAll('a').forEach(function(a) {
        a.addEventListener('click', function() {
            links.classList.remove('open');
            burger.classList.remove('active');
        });
    });

    // ---- Reveal on scroll ----
    var reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function(entries) {
            entries.forEach(function(e) {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

        reveals.forEach(function(el) { obs.observe(el); });
    }

    // ============================================
    // ADMIN-CONFIGURABLE WAIT TIMES
    // ============================================
    var WAIT_TIMES = {
        service: { fr: '~48 heures', en: '~48 hours' },
        repair:  { fr: '~3-4 jours ouvrables', en: '~3-4 business days' }
    };

    try {
        var savedWait = localStorage.getItem('electrauto-wait-times');
        if (savedWait) WAIT_TIMES = JSON.parse(savedWait);
    } catch(e) {}

    // ============================================
    // FORM LOGIC
    // ============================================
    var form = document.getElementById('appt-form');
    if (!form) return;

    // ---- Client Type Toggle ----
    var clientTypeInput = form.querySelector('[name="clientType"]');
    var toggleBtns = document.querySelectorAll('#client-type-toggle .appt-toggle__btn');

    toggleBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            toggleBtns.forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            clientTypeInput.value = btn.getAttribute('data-value');
        });
    });

    // ---- Contact Preference Toggle ----
    var contactPrefInput = form.querySelector('[name="contactPref"]');
    var contactPrefBtns = document.querySelectorAll('#contact-pref-toggle .appt-toggle__btn');

    contactPrefBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            contactPrefBtns.forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            contactPrefInput.value = btn.getAttribute('data-value');
        });
    });

    // ---- Input Filtering (digits only) ----
    function digitsOnly(input) {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^\d]/g, '');
        });
    }

    var phoneField = form.querySelector('[name="phone"]');
    var yearField = form.querySelector('[name="year"]');
    var mileageField = form.querySelector('[name="mileage"]');

    // Phone formatting (xxx) xxx-xxxx
    if (phoneField) {
        phoneField.addEventListener('input', function() {
            var digits = this.value.replace(/\D/g, '').substring(0, 10);
            if (digits.length >= 7) {
                this.value = '(' + digits.substring(0,3) + ') ' + digits.substring(3,6) + '-' + digits.substring(6);
            } else if (digits.length >= 4) {
                this.value = '(' + digits.substring(0,3) + ') ' + digits.substring(3);
            } else if (digits.length > 0) {
                this.value = '(' + digits;
            }
        });
    }
    if (yearField) digitsOnly(yearField);
    if (mileageField) digitsOnly(mileageField);

    // ---- Textarea auto-resize ----
    var descTextarea = form.querySelector('textarea[name="description"]');
    if (descTextarea) {
        descTextarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    }

    // ---- Service Type Cards ----
    var serviceTypeInput = form.querySelector('[name="serviceType"]');
    var serviceCards = document.querySelectorAll('#service-type-cards .appt-card');
    var sectionDesc = document.getElementById('section-description');
    var sectionCourtesy = document.getElementById('section-courtesy');
    var sectionSubmit = document.getElementById('section-submit');
    var waitDisplay = document.getElementById('wait-time-display');
    var waitValue = document.getElementById('wait-time-value');
    var descTitle = document.getElementById('desc-title');
    var descLabel = document.getElementById('desc-label');
    var currentServiceType = '';

    var DESC_TEXT = {
        service: {
            title:  { fr: 'Décrivez le service souhaité', en: 'Describe the service needed' },
            label:  { fr: 'Ex: vidange d\'huile, changement de pneus, inspection...', en: 'E.g. oil change, tire swap, inspection...' }
        },
        repair: {
            title:  { fr: 'Décrivez le problème', en: 'Describe the problem' },
            label:  { fr: 'Ex: bruit au freinage, voyant moteur allumé, surchauffe...', en: 'E.g. brake noise, check engine light, overheating...' }
        }
    };

    function updateDescText() {
        if (!currentServiceType || !descTitle) return;
        var lang = document.documentElement.lang || 'fr';
        var t = DESC_TEXT[currentServiceType];
        if (!t) return;
        descTitle.textContent = t.title[lang] || t.title.fr;
        descTitle.setAttribute('data-fr', t.title.fr);
        descTitle.setAttribute('data-en', t.title.en);
        descLabel.textContent = t.label[lang] || t.label.fr;
        descLabel.setAttribute('data-fr', t.label.fr);
        descLabel.setAttribute('data-en', t.label.en);
    }

    serviceCards.forEach(function(card) {
        card.addEventListener('click', function() {
            serviceCards.forEach(function(c) { c.classList.remove('selected'); });
            card.classList.add('selected');
            currentServiceType = card.getAttribute('data-value');
            serviceTypeInput.value = currentServiceType;

            // Update description section text
            updateDescText();

            // Show hidden sections
            showSection(sectionDesc);
            showSection(sectionCourtesy);
            showSection(sectionSubmit);

            // Update wait time
            updateWaitTimeText();
            waitDisplay.style.display = 'flex';

            // Observe newly revealed elements
            sectionDesc.querySelectorAll('.reveal:not(.visible)').forEach(function(el) { obs.observe(el); });
            sectionCourtesy.querySelectorAll('.reveal:not(.visible)').forEach(function(el) { obs.observe(el); });
            sectionSubmit.querySelectorAll('.reveal:not(.visible)').forEach(function(el) { obs.observe(el); });
        });
    });

    function showSection(el) {
        if (el.classList.contains('appt-section--hidden')) {
            el.classList.remove('appt-section--hidden');
            el.classList.add('appt-section--visible');
        }
    }

    function updateWaitTimeText() {
        if (!currentServiceType || !waitValue) return;
        var lang = document.documentElement.lang || 'fr';
        var key = currentServiceType === 'repair' ? 'repair' : 'service';
        var wt = WAIT_TIMES[key];
        if (wt) {
            waitValue.textContent = wt[lang] || wt.fr;
        }
    }

    // ---- Photo Upload ----
    var photoInput = document.getElementById('photo-input');
    var photoPreview = document.getElementById('photo-preview');
    var uploadArea = document.getElementById('upload-area');
    var selectedFiles = [];
    var MAX_PHOTOS = 5;

    if (uploadArea) {
        uploadArea.addEventListener('click', function(e) {
            e.preventDefault();
            photoInput.click();
        });

        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.classList.add('appt-upload__area--dragover');
        });

        uploadArea.addEventListener('dragleave', function() {
            uploadArea.classList.remove('appt-upload__area--dragover');
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('appt-upload__area--dragover');
            handleFiles(e.dataTransfer.files);
        });
    }

    if (photoInput) {
        photoInput.addEventListener('change', function() {
            handleFiles(photoInput.files);
            photoInput.value = '';
        });
    }

    function handleFiles(files) {
        Array.from(files).forEach(function(file) {
            if (!file.type.startsWith('image/')) return;
            if (selectedFiles.length >= MAX_PHOTOS) return;
            selectedFiles.push(file);
        });
        renderPreviews();
    }

    function renderPreviews() {
        photoPreview.innerHTML = '';
        selectedFiles.forEach(function(file, i) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var thumb = document.createElement('div');
                thumb.className = 'appt-upload__thumb';
                thumb.innerHTML = '<img src="' + e.target.result + '" alt="">' +
                    '<button type="button" class="appt-upload__remove" data-index="' + i + '">&times;</button>';
                photoPreview.appendChild(thumb);
            };
            reader.readAsDataURL(file);
        });
    }

    if (photoPreview) {
        photoPreview.addEventListener('click', function(e) {
            var removeBtn = e.target.closest('.appt-upload__remove');
            if (removeBtn) {
                var idx = parseInt(removeBtn.getAttribute('data-index'));
                selectedFiles.splice(idx, 1);
                renderPreviews();
            }
        });
    }

    // ---- Resize image for upload ----
    function resizeImage(file, maxWidth, quality) {
        return new Promise(function(resolve) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var img = new Image();
                img.onload = function() {
                    var canvas = document.createElement('canvas');
                    var w = img.width;
                    var h = img.height;
                    if (w > maxWidth) {
                        h = Math.round(h * maxWidth / w);
                        w = maxWidth;
                    }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    var base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
                    resolve({ name: file.name, type: 'image/jpeg', data: base64 });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // ---- Validation ----
    function validateForm() {
        // Clear previous errors
        form.querySelectorAll('.appt-error').forEach(function(el) {
            el.classList.remove('appt-error');
        });

        var valid = true;
        var pref = contactPrefInput.value;

        // Always required: name, makeModel, year
        var required = ['name', 'makeModel', 'year'];

        // Conditionally require phone or email based on preference
        if (pref === 'phone') {
            required.push('phone');
        } else {
            required.push('email');
        }

        required.forEach(function(fieldName) {
            var input = form.querySelector('[name="' + fieldName + '"]');
            if (input && !input.value.trim()) {
                input.closest('.field').classList.add('appt-error');
                valid = false;
            }
        });

        // Phone format (min 10 digits)
        var phoneEl = form.querySelector('[name="phone"]');
        if (phoneEl && phoneEl.value.trim() && phoneEl.value.trim().length < 10) {
            phoneEl.closest('.field').classList.add('appt-error');
            valid = false;
        }

        // Email format (validate if filled, regardless of preference)
        var emailEl = form.querySelector('[name="email"]');
        if (emailEl && emailEl.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
            emailEl.closest('.field').classList.add('appt-error');
            valid = false;
        }

        // Year range
        var yearEl = form.querySelector('[name="year"]');
        if (yearEl && yearEl.value.trim()) {
            var y = parseInt(yearEl.value.trim());
            if (isNaN(y) || y < 1000 || y > 9999) {
                yearEl.closest('.field').classList.add('appt-error');
                valid = false;
            }
        }

        // Service type
        if (!serviceTypeInput.value) {
            document.getElementById('service-type-cards').classList.add('appt-error');
            valid = false;
        }

        // Description (only if section is visible)
        if (sectionDesc && !sectionDesc.classList.contains('appt-section--hidden')) {
            var descInput = form.querySelector('[name="description"]');
            if (descInput && !descInput.value.trim()) {
                descInput.closest('.field').classList.add('appt-error');
                valid = false;
            }
        }

        return valid;
    }

    // ---- Form Submit ----
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!validateForm()) {
            // Scroll to first error
            var firstError = form.querySelector('.appt-error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        var btn = form.querySelector('[type="submit"]');
        var origHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span>...</span>';

        var errorDiv = document.getElementById('appt-error');

        try {
            // Resize and convert photos
            var photoData = [];
            for (var i = 0; i < selectedFiles.length; i++) {
                var resized = await resizeImage(selectedFiles[i], 1200, 0.7);
                photoData.push(resized);
            }

            var courtesyInput = form.querySelector('[name="courtesy"]:checked');
            var payload = {
                clientType: clientTypeInput.value,
                name: form.querySelector('[name="name"]').value.trim(),
                phone: form.querySelector('[name="phone"]').value.trim(),
                email: form.querySelector('[name="email"]').value.trim(),
                contactPref: contactPrefInput.value,
                makeModel: form.querySelector('[name="makeModel"]').value.trim(),
                year: form.querySelector('[name="year"]').value.trim(),
                mileage: form.querySelector('[name="mileage"]').value.trim(),
                vin: form.querySelector('[name="vin"]').value.trim(),
                serviceType: serviceTypeInput.value,
                description: form.querySelector('[name="description"]').value.trim(),
                courtesy: courtesyInput ? courtesyInput.value : 'none',
                photos: photoData
            };

            var res = await fetch('/api/appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error();

            // Show success inside the form container
            var lang = document.documentElement.lang || 'fr';
            form.innerHTML = '<div class="appt-section"><div class="appt-success" style="display:block;">'
                + '<div class="appt-success__icon">'
                + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>'
                + '</div>'
                + '<h2>' + (lang === 'en' ? 'Request received!' : 'Demande reçue !') + '</h2>'
                + '<p>' + (lang === 'en'
                    ? 'We have received your appointment request. A team member will contact you shortly to confirm your appointment.'
                    : 'Nous avons bien reçu votre demande de rendez-vous. Un membre de notre équipe communiquera avec vous sous peu pour confirmer votre rendez-vous.') + '</p>'
                + '<a href="index-v2.html" class="btn btn--ghost">' + (lang === 'en' ? 'Back to home' : 'Retour à l\'accueil') + '</a>'
                + '</div></div>';
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });

        } catch(err) {
            var lang = document.documentElement.lang || 'fr';
            errorDiv.textContent = lang === 'en'
                ? 'An error occurred. Please try again.'
                : 'Une erreur est survenue. Veuillez réessayer.';
            errorDiv.className = 'form-status error';
        }

        btn.disabled = false;
        btn.innerHTML = origHTML;
    });

})();
