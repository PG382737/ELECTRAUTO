// ============================================
// ELECTRAUTO — Admin Panel Internationalization
// ============================================

var TRANSLATIONS = {
    fr: {
        // Sidebar
        'sidebar.gestion': 'Gestion',
        'sidebar.delays': 'D\u00e9lais',
        'sidebar.notes': 'Notes',
        'sidebar.blog': 'Blog',
        'sidebar.config': 'Configuration',
        'sidebar.logout': 'D\u00e9connexion',

        // Login
        'login.title': 'Administration',
        'login.password_placeholder': 'Mot de passe',
        'login.submit': 'Acc\u00e9der',
        'login.2fa_check_email': 'V\u00e9rifiez vos courriels',
        'login.2fa_code_placeholder': 'Code \u00e0 6 chiffres',
        'login.2fa_remember': 'Ne plus demander pendant 30 jours',
        'login.2fa_verify': 'V\u00e9rifier',
        'login.2fa_back': 'Retour',
        'login.lockout_title': 'Acc\u00e8s bloqu\u00e9',
        'login.lockout_msg': 'Trop de tentatives \u00e9chou\u00e9es.',
        'login.attempts_singular': ' essai restant avant blocage',
        'login.attempts_plural': ' essais restants avant blocage',
        'login.error_server': 'Erreur serveur',
        'login.error_connection': 'Erreur de connexion.',
        'login.2fa_enter_code': 'Entrez le code \u00e0 6 chiffres.',
        'login.2fa_invalid': 'Code invalide.',
        'login.2fa_error': 'Erreur de v\u00e9rification.',

        // Configuration (Security) tab
        'config.title': 'Configuration',
        'config.2fa_title': 'V\u00e9rification 2FA',
        'config.2fa_desc': 'Exiger un code d\'authentification \u00e0 deux facteurs lors de la connexion.',
        'config.lang_title': 'Langue de l\'interface',
        'config.lang_desc': 'Choisissez la langue d\'affichage du panneau d\'administration.',

        // Control subtabs
        'control.employees': 'Employ\u00e9s',
        'control.vehicles': 'Voitures',
        'control.monitoring': 'Monitoring',
        'control.dashboard': 'Dashboard',

        // Notifications
        'notif.title': 'Notifications',
        'notif.clear': 'Tout effacer',
        'notif.empty': 'Aucune notification',
        'notif.just_now': '\u00c0 l\'instant',

        // Employees
        'emp.title': 'Employ\u00e9s',
        'emp.new': 'Nouvel employ\u00e9',
        'emp.empty': 'Aucun employ\u00e9. Ajoutez votre premier employ\u00e9.',
        'emp.col_name': 'Nom',
        'emp.col_hire_date': 'Date d\'embauche',
        'emp.col_nfc': 'Badge NFC',
        'emp.col_actions': 'Actions',
        'emp.nfc_assigned': 'Assign\u00e9',
        'emp.nfc_unassigned': 'Non assign\u00e9',
        'emp.btn_stats': 'Stats',
        'emp.btn_edit': 'Modifier',
        'emp.btn_delete': 'Supprimer',
        'emp.modal_new': 'Nouvel employ\u00e9',
        'emp.modal_edit': 'Modifier l\'employ\u00e9',
        'emp.label_first_name': 'Pr\u00e9nom',
        'emp.label_last_name': 'Nom',
        'emp.label_hire_date': 'Date d\'embauche',
        'emp.label_nfc': 'Badge NFC',
        'emp.nfc_placeholder': 'Aucun badge assign\u00e9',
        'emp.nfc_scan': 'Scanner',
        'emp.nfc_remove': 'Retirer',
        'emp.btn_cancel': 'Annuler',
        'emp.btn_save': 'Sauvegarder',
        'emp.delete_title': 'Supprimer cet employ\u00e9 ?',
        'emp.delete_msg': 'L\'employ\u00e9 et tout son historique seront supprim\u00e9s.',
        'emp.hire_date_placeholder': 'jj-mm-aaaa',

        // Employee Stats
        'emp_stats.title': 'Statistiques',
        'emp_stats.period_day': 'Aujourd\'hui',
        'emp_stats.period_week': 'Semaine',
        'emp_stats.period_month': 'Mois',
        'emp_stats.period_year': 'Ann\u00e9e',
        'emp_stats.period_all': 'Tout',
        'emp_stats.hours': 'Heures travaill\u00e9es',
        'emp_stats.vehicles': 'V\u00e9hicules',
        'emp_stats.avg_time': 'Temps moyen / v\u00e9hicule',
        'emp_stats.recent_history': 'Historique r\u00e9cent',
        'emp_stats.no_orders': 'Aucun bon de travail pour cette p\u00e9riode.',
        'emp_stats.col_date': 'Date',
        'emp_stats.col_vehicle': 'V\u00e9hicule',
        'emp_stats.col_duration': 'Dur\u00e9e',
        'emp_stats.unknown': 'Inconnu',

        // Vehicles
        'veh.title': 'Voitures',
        'veh.new': 'Nouveau v\u00e9hicule',
        'veh.empty': 'Aucun v\u00e9hicule. Ajoutez votre premier v\u00e9hicule.',
        'veh.no_results': 'Aucun r\u00e9sultat pour \u00ab ',
        'veh.no_results_end': ' \u00bb',
        'veh.search_placeholder': 'Rechercher par v\u00e9hicule, propri\u00e9taire, t\u00e9l\u00e9phone, courriel, plaque, NIV, r\u00e9f\u00e9rence...',
        'veh.col_vehicle': 'V\u00e9hicule',
        'veh.col_owner': 'Propri\u00e9taire',
        'veh.col_plate': 'Plaque',
        'veh.col_nfc': 'Badge NFC',
        'veh.col_status': 'Statut',
        'veh.col_actions': 'Actions',
        'veh.nfc_assigned': 'Assign\u00e9',
        'veh.nfc_unassigned': 'Non assign\u00e9',
        'veh.btn_detail': 'D\u00e9tail',
        'veh.btn_edit': 'Modifier',
        'veh.btn_delete': 'Supprimer',
        'veh.modal_new': 'Nouveau v\u00e9hicule',
        'veh.modal_edit': 'Modifier le v\u00e9hicule',
        'veh.label_owner': 'Propri\u00e9taire *',
        'veh.label_phone': 'T\u00e9l\u00e9phone',
        'veh.label_email': 'Courriel',
        'veh.label_reference': 'R\u00e9f\u00e9rence',
        'veh.label_make': 'Marque *',
        'veh.label_model': 'Mod\u00e8le',
        'veh.label_year': 'Ann\u00e9e',
        'veh.label_color': 'Couleur',
        'veh.label_plate': 'Plaque',
        'veh.label_vin': 'NIV (VIN)',
        'veh.label_photo': 'Photo du v\u00e9hicule',
        'veh.label_nfc': 'Badge NFC',
        'veh.nfc_placeholder': 'Aucun badge assign\u00e9',
        'veh.nfc_scan': 'Scanner',
        'veh.nfc_remove': 'Retirer',
        'veh.btn_cancel': 'Annuler',
        'veh.btn_save': 'Sauvegarder',
        'veh.photo_add': 'Cliquez pour ajouter une photo',
        'veh.delete_title': 'Supprimer ce v\u00e9hicule ?',
        'veh.delete_msg': 'Le v\u00e9hicule et tout son historique seront supprim\u00e9s.',

        // Vehicle detail
        'veh_detail.title': 'D\u00e9tail du v\u00e9hicule',
        'veh_detail.owner': 'Propri\u00e9taire:',
        'veh_detail.phone': 'T\u00e9l:',
        'veh_detail.email': 'Courriel:',
        'veh_detail.plate': 'Plaque:',
        'veh_detail.color': 'Couleur:',
        'veh_detail.vin': 'VIN:',
        'veh_detail.reference': 'R\u00e9f\u00e9rence:',
        'veh_detail.in_progress': 'EN COURS',
        'veh_detail.since': 'Depuis ',
        'veh_detail.repairs': 'R\u00e9parations',
        'veh_detail.total_time': 'Temps total',
        'veh_detail.employees': 'Employ\u00e9s',
        'veh_detail.work_history': 'Historique des travaux',
        'veh_detail.no_history': 'Aucun historique.',
        'veh_detail.col_date': 'Date',
        'veh_detail.col_employee': 'Employ\u00e9',
        'veh_detail.col_duration': 'Dur\u00e9e',
        'veh_detail.notes_title': 'Notes',
        'veh_detail.note_placeholder': 'Ajouter une note...',
        'veh_detail.no_notes': 'Aucune note.',
        'veh_detail.unknown': 'Inconnu',

        // Scanner
        'scanner.close': 'Fermer',
        'scanner.title': 'Scanner NFC',
        'scanner.desc': 'Ouvrez le scanner plein \u00e9cran pour commencer \u00e0 puncher les bons de travail.',
        'scanner.open': 'Ouvrir le scanner',
        'scanner.vehicle_title': 'V\u00c9HICULE',
        'scanner.vehicle_scan': 'Scannez la carte NFC du v\u00e9hicule',
        'scanner.employee_title': 'EMPLOY\u00c9',
        'scanner.employee_scan': 'Scannez le badge de l\'employ\u00e9',
        'scanner.employee_close_scan': 'Scannez le badge pour fermer le bon de travail',
        'scanner.success_open': 'Bon de travail commenc\u00e9',
        'scanner.success_close': 'Bon de travail termin\u00e9',
        'scanner.countdown': 'Retour dans {n} secondes...',
        'scanner.error_vehicle': 'V\u00e9hicule introuvable',
        'scanner.error_employee': 'Employ\u00e9 introuvable',
        'scanner.active_orders_title': 'Bons de travail en cours',
        'scanner.loading': 'Chargement...',
        'scanner.no_active_orders': 'Aucun bon de travail en cours',
        'scanner.load_error': 'Impossible de charger les bons de travail',
        'scanner.owner_label': 'Propri\u00e9taire: ',
        'scanner.plate_label': 'Plaque: ',
        'scanner.employee_label': 'Employ\u00e9: ',

        // NFC status
        'nfc.connected': 'Lecteur NFC connect\u00e9',
        'nfc.connected_detail': 'Le lecteur est pr\u00eat \u00e0 scanner.',
        'nfc.no_reader': 'Lecteur USB non d\u00e9tect\u00e9',
        'nfc.no_reader_detail': 'Le serveur fonctionne mais aucun lecteur n\'est branch\u00e9.',
        'nfc.disconnected': 'Serveur NFC d\u00e9connect\u00e9',
        'nfc.disconnected_detail': 'Lancez ElectrAuto-NFC.exe pour connecter le lecteur.',
        'nfc.scan_badge': 'Scannez le badge NFC',
        'nfc.approach_card': 'Approchez la carte du lecteur...',
        'nfc.cancel': 'Annuler',
        'nfc.conflict_employee': 'Ce badge est d\u00e9j\u00e0 assign\u00e9 \u00e0 l\'employ\u00e9 ',
        'nfc.conflict_vehicle': 'Ce badge est d\u00e9j\u00e0 assign\u00e9 au v\u00e9hicule ',
        'nfc.badge_assigned_title': 'Badge d\u00e9j\u00e0 assign\u00e9',
        'nfc.no_reader_warn': 'Lecteur NFC non d\u00e9tect\u00e9',
        'nfc.check_usb': 'V\u00e9rifiez la connexion USB.',
        'nfc.manual_prompt': 'Serveur NFC non connect\u00e9.\nEntrez manuellement l\'identifiant du badge:',
        'nfc.action_impossible': 'Action impossible',
        'nfc.emp_has_open_order': 'Cet employ\u00e9 a un bon de travail ouvert.',
        'nfc.veh_has_open_order': 'Ce v\u00e9hicule a un bon de travail ouvert.',

        // NFC setup
        'nfc_setup.title': 'Configuration du poste',
        'nfc_setup.step1_title': 'Installer le driver ACR122U',
        'nfc_setup.step1_desc': 'T\u00e9l\u00e9chargez le MSI Installer depuis le site ACS. Une seule fois par ordinateur.',
        'nfc_setup.step2_title': 'T\u00e9l\u00e9charger NFC Reader',
        'nfc_setup.step2_desc': 'Le pont entre le lecteur USB et le navigateur. Placez-le dans un dossier permanent.',
        'nfc_setup.step3_title': 'Brancher le lecteur USB',
        'nfc_setup.step3_desc': 'Connectez le ACR122U. Windows le d\u00e9tectera automatiquement.',
        'nfc_setup.step4_title': 'Lancer NFC Reader',
        'nfc_setup.step4_desc': 'Double-cliquez sur le .exe. La pastille de statut passera au vert.',
        'nfc_setup.autostart': 'D\u00e9marrage automatique avec Windows',
        'nfc_setup.autostart_step1': 'Appuyez sur ',
        'nfc_setup.autostart_step2': 'Tapez ',
        'nfc_setup.autostart_step2b': ' puis Entr\u00e9e',
        'nfc_setup.autostart_step3': 'Copiez ',
        'nfc_setup.autostart_step3b': ' dans ce dossier',
        'nfc_setup.autostart_step4': 'Le serveur se lancera automatiquement au prochain d\u00e9marrage',

        // Monitoring
        'mon.title': 'Monitoring',
        'mon.live': 'En direct',
        'mon.employees_card': 'Employ\u00e9s',
        'mon.vehicles_card': 'V\u00e9hicules',
        'mon.active_orders_card': 'Bons en cours',
        'mon.completed_today': 'Compl\u00e9t\u00e9s aujourd\'hui',
        'mon.completed_week': 'Compl\u00e9t\u00e9s cette semaine',
        'mon.active_orders_title': 'Bons de travail en cours',
        'mon.recent_activity': 'Activit\u00e9 r\u00e9cente',
        'mon.no_active': 'Aucun bon de travail en cours',
        'mon.no_recent': 'Aucune activit\u00e9 r\u00e9cente',
        'mon.employee_label': 'Employ\u00e9: ',
        'mon.owner_label': 'Propri\u00e9taire: ',
        'mon.unknown': 'Inconnu',
        'mon.vehicle_default': 'V\u00e9hicule',

        // Pagination
        'pagination.prev': '\u00ab Pr\u00e9c\u00e9dent',
        'pagination.next': 'Suivant \u00bb',
        'pagination.page': 'Page {current} / {total}',

        // Blog
        'blog.title': 'Articles du blog',
        'blog.new': 'Nouvel article',
        'blog.empty': 'Aucun article. Cliquez sur \u00ab\u00a0Nouvel article\u00a0\u00bb pour commencer.',
        'blog.loading': 'Chargement...',
        'blog.col_title': 'Titre',
        'blog.col_date': 'Date',
        'blog.col_status': 'Statut',
        'blog.col_actions': 'Actions',
        'blog.published': 'Publi\u00e9',
        'blog.draft': 'Brouillon',
        'blog.btn_edit': 'Modifier',
        'blog.btn_delete': 'Supprimer',
        'blog.modal_new': 'Nouvel article',
        'blog.modal_edit': 'Modifier l\'article',
        'blog.tab_fr': 'Fran\u00e7ais',
        'blog.tab_en': 'English',
        'blog.label_title_fr': 'Titre',
        'blog.label_excerpt_fr': 'Extrait (r\u00e9sum\u00e9 court)',
        'blog.label_content': 'Contenu',
        'blog.placeholder_title_fr': 'Titre de l\'article en fran\u00e7ais',
        'blog.placeholder_excerpt_fr': 'Bref r\u00e9sum\u00e9 en fran\u00e7ais...',
        'blog.label_title_en': 'Title',
        'blog.label_excerpt_en': 'Excerpt (short summary)',
        'blog.label_content_en': 'Content',
        'blog.placeholder_title_en': 'Article title in English',
        'blog.placeholder_excerpt_en': 'Short summary in English...',
        'blog.label_image': 'Image principale',
        'blog.image_add': 'Cliquer pour ajouter',
        'blog.image_remove': 'Retirer l\'image',
        'blog.label_status': 'Statut',
        'blog.status_draft': 'Brouillon',
        'blog.status_published': 'Publi\u00e9',
        'blog.btn_cancel': 'Annuler',
        'blog.btn_save': 'Sauvegarder',
        'blog.saving': 'Sauvegarde...',
        'blog.title_required': 'Le titre fran\u00e7ais est requis.',
        'blog.content_required': 'Le contenu fran\u00e7ais est requis.',
        'blog.delete_title': 'Supprimer cet article ?',
        'blog.delete_msg': 'Cette action est irr\u00e9versible.',
        'blog.delete_cancel': 'Annuler',
        'blog.delete_confirm': 'Supprimer',

        // Crop modal
        'crop.title': 'Recadrer l\'image',
        'crop.ratio_free': 'Libre',
        'crop.cancel': 'Annuler',
        'crop.confirm': 'Recadrer',
        'crop.error': 'Erreur upload: ',

        // Delays
        'delays.title': 'D\u00e9lais de rendez-vous',
        'delays.desc': 'S\u00e9lectionnez le d\u00e9lai actuel pour chaque type de service. Ces informations seront affich\u00e9es aux clients sur la page de prise de rendez-vous.',
        'delays.service': 'Service',
        'delays.repair': 'R\u00e9paration',
        'delays.less_24h': 'Moins de 24h',
        'delays.1_2_days': '1 \u00e0 2 jours',
        'delays.2_4_days': '2 \u00e0 4 jours',
        'delays.less_1_week': 'Moins d\'une semaine',
        'delays.1_2_weeks': '1 \u00e0 2 semaines',
        'delays.less_1_month': 'Moins de 1 mois',
        'delays.saved': 'D\u00e9lais sauvegard\u00e9s avec succ\u00e8s.',

        // Notes
        'notes.title': 'Notes',
        'notes.empty': 'Aucune note. \u00c9crivez votre premi\u00e8re note ci-dessous.',
        'notes.placeholder': '\u00c9crire une note...',
        'notes.delete_tooltip': 'Supprimer',
        'notes.today': 'Aujourd\'hui \u00e0 ',
        'notes.yesterday': 'Hier \u00e0 ',

        // Confirm / general
        'confirm.delete_title': 'Confirmer la suppression ?',
        'confirm.delete_msg': 'Cette action est irr\u00e9versible.',
        'confirm.cancel': 'Annuler',
        'confirm.delete': 'Supprimer',
        'general.error': 'Erreur',
        'general.error_prefix': 'Erreur: ',
        'general.error_upload': 'Erreur upload',
        'general.link_url': 'URL du lien:',

        // Date picker
        'datepicker.months': ['Janvier','F\u00e9vrier','Mars','Avril','Mai','Juin','Juillet','Ao\u00fbt','Septembre','Octobre','Novembre','D\u00e9cembre'],
        'datepicker.weekdays': ['Lu','Ma','Me','Je','Ve','Sa','Di'],
        'datepicker.today': 'Aujourd\'hui',

        // Work orders
        'wo.started': 'Bon de travail commenc\u00e9',
        'wo.ended': 'Bon de travail termin\u00e9',

        // Notifications format
        'notif.time_min': ' min',
        'notif.time_h': 'h',
        'notif.time_d': 'j'
    },

    en: {
        // Sidebar
        'sidebar.gestion': 'Management',
        'sidebar.delays': 'Delays',
        'sidebar.notes': 'Notes',
        'sidebar.blog': 'Blog',
        'sidebar.config': 'Configuration',
        'sidebar.logout': 'Logout',

        // Login
        'login.title': 'Administration',
        'login.password_placeholder': 'Password',
        'login.submit': 'Log in',
        'login.2fa_check_email': 'Check your email',
        'login.2fa_code_placeholder': '6-digit code',
        'login.2fa_remember': 'Don\'t ask again for 30 days',
        'login.2fa_verify': 'Verify',
        'login.2fa_back': 'Back',
        'login.lockout_title': 'Access blocked',
        'login.lockout_msg': 'Too many failed attempts.',
        'login.attempts_singular': ' attempt remaining before lockout',
        'login.attempts_plural': ' attempts remaining before lockout',
        'login.error_server': 'Server error',
        'login.error_connection': 'Connection error.',
        'login.2fa_enter_code': 'Enter the 6-digit code.',
        'login.2fa_invalid': 'Invalid code.',
        'login.2fa_error': 'Verification error.',

        // Configuration (Security) tab
        'config.title': 'Configuration',
        'config.2fa_title': '2FA Verification',
        'config.2fa_desc': 'Require a two-factor authentication code when logging in.',
        'config.lang_title': 'Interface Language',
        'config.lang_desc': 'Choose the display language for the admin panel.',

        // Control subtabs
        'control.employees': 'Employees',
        'control.vehicles': 'Vehicles',
        'control.monitoring': 'Monitoring',
        'control.dashboard': 'Dashboard',

        // Notifications
        'notif.title': 'Notifications',
        'notif.clear': 'Clear all',
        'notif.empty': 'No notifications',
        'notif.just_now': 'Just now',

        // Employees
        'emp.title': 'Employees',
        'emp.new': 'New employee',
        'emp.empty': 'No employees. Add your first employee.',
        'emp.col_name': 'Name',
        'emp.col_hire_date': 'Hire date',
        'emp.col_nfc': 'NFC Badge',
        'emp.col_actions': 'Actions',
        'emp.nfc_assigned': 'Assigned',
        'emp.nfc_unassigned': 'Unassigned',
        'emp.btn_stats': 'Stats',
        'emp.btn_edit': 'Edit',
        'emp.btn_delete': 'Delete',
        'emp.modal_new': 'New employee',
        'emp.modal_edit': 'Edit employee',
        'emp.label_first_name': 'First name',
        'emp.label_last_name': 'Last name',
        'emp.label_hire_date': 'Hire date',
        'emp.label_nfc': 'NFC Badge',
        'emp.nfc_placeholder': 'No badge assigned',
        'emp.nfc_scan': 'Scan',
        'emp.nfc_remove': 'Remove',
        'emp.btn_cancel': 'Cancel',
        'emp.btn_save': 'Save',
        'emp.delete_title': 'Delete this employee?',
        'emp.delete_msg': 'The employee and all their history will be deleted.',
        'emp.hire_date_placeholder': 'dd-mm-yyyy',

        // Employee Stats
        'emp_stats.title': 'Statistics',
        'emp_stats.period_day': 'Today',
        'emp_stats.period_week': 'Week',
        'emp_stats.period_month': 'Month',
        'emp_stats.period_year': 'Year',
        'emp_stats.period_all': 'All',
        'emp_stats.hours': 'Hours worked',
        'emp_stats.vehicles': 'Vehicles',
        'emp_stats.avg_time': 'Avg. time / vehicle',
        'emp_stats.recent_history': 'Recent history',
        'emp_stats.no_orders': 'No work orders for this period.',
        'emp_stats.col_date': 'Date',
        'emp_stats.col_vehicle': 'Vehicle',
        'emp_stats.col_duration': 'Duration',
        'emp_stats.unknown': 'Unknown',

        // Vehicles
        'veh.title': 'Vehicles',
        'veh.new': 'New vehicle',
        'veh.empty': 'No vehicles. Add your first vehicle.',
        'veh.no_results': 'No results for "',
        'veh.no_results_end': '"',
        'veh.search_placeholder': 'Search by vehicle, owner, phone, email, plate, VIN, reference...',
        'veh.col_vehicle': 'Vehicle',
        'veh.col_owner': 'Owner',
        'veh.col_plate': 'Plate',
        'veh.col_nfc': 'NFC Badge',
        'veh.col_status': 'Status',
        'veh.col_actions': 'Actions',
        'veh.nfc_assigned': 'Assigned',
        'veh.nfc_unassigned': 'Unassigned',
        'veh.btn_detail': 'Detail',
        'veh.btn_edit': 'Edit',
        'veh.btn_delete': 'Delete',
        'veh.modal_new': 'New vehicle',
        'veh.modal_edit': 'Edit vehicle',
        'veh.label_owner': 'Owner *',
        'veh.label_phone': 'Phone',
        'veh.label_email': 'Email',
        'veh.label_reference': 'Reference',
        'veh.label_make': 'Make *',
        'veh.label_model': 'Model',
        'veh.label_year': 'Year',
        'veh.label_color': 'Color',
        'veh.label_plate': 'Plate',
        'veh.label_vin': 'VIN',
        'veh.label_photo': 'Vehicle photo',
        'veh.label_nfc': 'NFC Badge',
        'veh.nfc_placeholder': 'No badge assigned',
        'veh.nfc_scan': 'Scan',
        'veh.nfc_remove': 'Remove',
        'veh.btn_cancel': 'Cancel',
        'veh.btn_save': 'Save',
        'veh.photo_add': 'Click to add a photo',
        'veh.delete_title': 'Delete this vehicle?',
        'veh.delete_msg': 'The vehicle and all its history will be deleted.',

        // Vehicle detail
        'veh_detail.title': 'Vehicle detail',
        'veh_detail.owner': 'Owner:',
        'veh_detail.phone': 'Phone:',
        'veh_detail.email': 'Email:',
        'veh_detail.plate': 'Plate:',
        'veh_detail.color': 'Color:',
        'veh_detail.vin': 'VIN:',
        'veh_detail.reference': 'Reference:',
        'veh_detail.in_progress': 'IN PROGRESS',
        'veh_detail.since': 'Since ',
        'veh_detail.repairs': 'Repairs',
        'veh_detail.total_time': 'Total time',
        'veh_detail.employees': 'Employees',
        'veh_detail.work_history': 'Work history',
        'veh_detail.no_history': 'No history.',
        'veh_detail.col_date': 'Date',
        'veh_detail.col_employee': 'Employee',
        'veh_detail.col_duration': 'Duration',
        'veh_detail.notes_title': 'Notes',
        'veh_detail.note_placeholder': 'Add a note...',
        'veh_detail.no_notes': 'No notes.',
        'veh_detail.unknown': 'Unknown',

        // Scanner
        'scanner.close': 'Close',
        'scanner.title': 'NFC Scanner',
        'scanner.desc': 'Open the full-screen scanner to start punching work orders.',
        'scanner.open': 'Open scanner',
        'scanner.vehicle_title': 'VEHICLE',
        'scanner.vehicle_scan': 'Scan the vehicle NFC card',
        'scanner.employee_title': 'EMPLOYEE',
        'scanner.employee_scan': 'Scan the employee badge',
        'scanner.employee_close_scan': 'Scan the badge to close the work order',
        'scanner.success_open': 'Work order started',
        'scanner.success_close': 'Work order completed',
        'scanner.countdown': 'Returning in {n} seconds...',
        'scanner.error_vehicle': 'Vehicle not found',
        'scanner.error_employee': 'Employee not found',
        'scanner.active_orders_title': 'Active work orders',
        'scanner.loading': 'Loading...',
        'scanner.no_active_orders': 'No active work orders',
        'scanner.load_error': 'Unable to load work orders',
        'scanner.owner_label': 'Owner: ',
        'scanner.plate_label': 'Plate: ',
        'scanner.employee_label': 'Employee: ',

        // NFC status
        'nfc.connected': 'NFC reader connected',
        'nfc.connected_detail': 'The reader is ready to scan.',
        'nfc.no_reader': 'USB reader not detected',
        'nfc.no_reader_detail': 'The server is running but no reader is plugged in.',
        'nfc.disconnected': 'NFC server disconnected',
        'nfc.disconnected_detail': 'Launch ElectrAuto-NFC.exe to connect the reader.',
        'nfc.scan_badge': 'Scan the NFC badge',
        'nfc.approach_card': 'Bring the card near the reader...',
        'nfc.cancel': 'Cancel',
        'nfc.conflict_employee': 'This badge is already assigned to employee ',
        'nfc.conflict_vehicle': 'This badge is already assigned to vehicle ',
        'nfc.badge_assigned_title': 'Badge already assigned',
        'nfc.no_reader_warn': 'NFC reader not detected',
        'nfc.check_usb': 'Check USB connection.',
        'nfc.manual_prompt': 'NFC server not connected.\nManually enter the badge ID:',
        'nfc.action_impossible': 'Action impossible',
        'nfc.emp_has_open_order': 'This employee has an open work order.',
        'nfc.veh_has_open_order': 'This vehicle has an open work order.',

        // NFC setup
        'nfc_setup.title': 'Workstation setup',
        'nfc_setup.step1_title': 'Install ACR122U driver',
        'nfc_setup.step1_desc': 'Download the MSI Installer from the ACS website. One time per computer.',
        'nfc_setup.step2_title': 'Download NFC Reader',
        'nfc_setup.step2_desc': 'The bridge between the USB reader and the browser. Place it in a permanent folder.',
        'nfc_setup.step3_title': 'Plug in the USB reader',
        'nfc_setup.step3_desc': 'Connect the ACR122U. Windows will detect it automatically.',
        'nfc_setup.step4_title': 'Launch NFC Reader',
        'nfc_setup.step4_desc': 'Double-click the .exe file. The status indicator will turn green.',
        'nfc_setup.autostart': 'Auto-start with Windows',
        'nfc_setup.autostart_step1': 'Press ',
        'nfc_setup.autostart_step2': 'Type ',
        'nfc_setup.autostart_step2b': ' then Enter',
        'nfc_setup.autostart_step3': 'Copy ',
        'nfc_setup.autostart_step3b': ' into this folder',
        'nfc_setup.autostart_step4': 'The server will start automatically on next boot',

        // Monitoring
        'mon.title': 'Monitoring',
        'mon.live': 'Live',
        'mon.employees_card': 'Employees',
        'mon.vehicles_card': 'Vehicles',
        'mon.active_orders_card': 'Active orders',
        'mon.completed_today': 'Completed today',
        'mon.completed_week': 'Completed this week',
        'mon.active_orders_title': 'Active work orders',
        'mon.recent_activity': 'Recent activity',
        'mon.no_active': 'No active work orders',
        'mon.no_recent': 'No recent activity',
        'mon.employee_label': 'Employee: ',
        'mon.owner_label': 'Owner: ',
        'mon.unknown': 'Unknown',
        'mon.vehicle_default': 'Vehicle',

        // Pagination
        'pagination.prev': '\u00ab Previous',
        'pagination.next': 'Next \u00bb',
        'pagination.page': 'Page {current} / {total}',

        // Blog
        'blog.title': 'Blog articles',
        'blog.new': 'New article',
        'blog.empty': 'No articles. Click "New article" to get started.',
        'blog.loading': 'Loading...',
        'blog.col_title': 'Title',
        'blog.col_date': 'Date',
        'blog.col_status': 'Status',
        'blog.col_actions': 'Actions',
        'blog.published': 'Published',
        'blog.draft': 'Draft',
        'blog.btn_edit': 'Edit',
        'blog.btn_delete': 'Delete',
        'blog.modal_new': 'New article',
        'blog.modal_edit': 'Edit article',
        'blog.tab_fr': 'Fran\u00e7ais',
        'blog.tab_en': 'English',
        'blog.label_title_fr': 'Title',
        'blog.label_excerpt_fr': 'Excerpt (short summary)',
        'blog.label_content': 'Content',
        'blog.placeholder_title_fr': 'Article title in French',
        'blog.placeholder_excerpt_fr': 'Short summary in French...',
        'blog.label_title_en': 'Title',
        'blog.label_excerpt_en': 'Excerpt (short summary)',
        'blog.label_content_en': 'Content',
        'blog.placeholder_title_en': 'Article title in English',
        'blog.placeholder_excerpt_en': 'Short summary in English...',
        'blog.label_image': 'Main image',
        'blog.image_add': 'Click to add',
        'blog.image_remove': 'Remove image',
        'blog.label_status': 'Status',
        'blog.status_draft': 'Draft',
        'blog.status_published': 'Published',
        'blog.btn_cancel': 'Cancel',
        'blog.btn_save': 'Save',
        'blog.saving': 'Saving...',
        'blog.title_required': 'French title is required.',
        'blog.content_required': 'French content is required.',
        'blog.delete_title': 'Delete this article?',
        'blog.delete_msg': 'This action is irreversible.',
        'blog.delete_cancel': 'Cancel',
        'blog.delete_confirm': 'Delete',

        // Crop modal
        'crop.title': 'Crop image',
        'crop.ratio_free': 'Free',
        'crop.cancel': 'Cancel',
        'crop.confirm': 'Crop',
        'crop.error': 'Upload error: ',

        // Delays
        'delays.title': 'Appointment delays',
        'delays.desc': 'Select the current delay for each type of service. This information will be displayed to customers on the appointment booking page.',
        'delays.service': 'Service',
        'delays.repair': 'Repair',
        'delays.less_24h': 'Less than 24h',
        'delays.1_2_days': '1 to 2 days',
        'delays.2_4_days': '2 to 4 days',
        'delays.less_1_week': 'Less than 1 week',
        'delays.1_2_weeks': '1 to 2 weeks',
        'delays.less_1_month': 'Less than 1 month',
        'delays.saved': 'Delays saved successfully.',

        // Notes
        'notes.title': 'Notes',
        'notes.empty': 'No notes. Write your first note below.',
        'notes.placeholder': 'Write a note...',
        'notes.delete_tooltip': 'Delete',
        'notes.today': 'Today at ',
        'notes.yesterday': 'Yesterday at ',

        // Confirm / general
        'confirm.delete_title': 'Confirm deletion?',
        'confirm.delete_msg': 'This action is irreversible.',
        'confirm.cancel': 'Cancel',
        'confirm.delete': 'Delete',
        'general.error': 'Error',
        'general.error_prefix': 'Error: ',
        'general.error_upload': 'Upload error',
        'general.link_url': 'Link URL:',

        // Date picker
        'datepicker.months': ['January','February','March','April','May','June','July','August','September','October','November','December'],
        'datepicker.weekdays': ['Mo','Tu','We','Th','Fr','Sa','Su'],
        'datepicker.today': 'Today',

        // Work orders
        'wo.started': 'Work order started',
        'wo.ended': 'Work order completed',

        // Notifications format
        'notif.time_min': ' min',
        'notif.time_h': 'h',
        'notif.time_d': 'd'
    }
};

var currentLang = localStorage.getItem('admin-lang') || 'fr';

function t(key) {
    return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || (TRANSLATIONS.fr[key]) || key;
}

function setAdminLang(lang) {
    currentLang = lang;
    localStorage.setItem('admin-lang', lang);
}

function refreshAdminUI() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        var val = t(key);
        if (typeof val === 'string') {
            // Check if it's a placeholder attribute
            if (el.hasAttribute('data-i18n-attr')) {
                el.setAttribute(el.getAttribute('data-i18n-attr'), val);
            } else {
                el.textContent = val;
            }
        }
    });

    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
        var key = el.getAttribute('data-i18n-placeholder');
        var val = t(key);
        if (typeof val === 'string') {
            el.placeholder = val;
        }
    });

    // Update select options
    var statusSelect = document.getElementById('edit-status');
    if (statusSelect) {
        statusSelect.options[0].textContent = t('blog.status_draft');
        statusSelect.options[1].textContent = t('blog.status_published');
    }

    // Update language toggle active state and styling
    document.querySelectorAll('.lang-switch-btn').forEach(function(btn) {
        var isActive = btn.getAttribute('data-lang-switch') === currentLang;
        btn.classList.toggle('active', isActive);
        if (isActive) {
            btn.style.background = 'var(--accent)';
            btn.style.color = '#000';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-muted)';
        }
    });

    // Re-render the currently active tab
    var activeTab = sessionStorage.getItem('admin-tab');
    if (activeTab === 'control') {
        var activeSubtab = sessionStorage.getItem('control-subtab');
        if (activeSubtab === 'employees' && window.Control) {
            // Trigger re-render
            var empBtn = document.querySelector('.control-subtab[data-subtab="employees"]');
            if (empBtn) empBtn.click();
        } else if (activeSubtab === 'vehicles' && window.Control) {
            var vehBtn = document.querySelector('.control-subtab[data-subtab="vehicles"]');
            if (vehBtn) vehBtn.click();
        } else if (activeSubtab === 'monitoring' && window.Control) {
            var monBtn = document.querySelector('.control-subtab[data-subtab="monitoring"]');
            if (monBtn) monBtn.click();
        }
    } else if (activeTab === 'blog') {
        if (typeof loadArticles === 'function') loadArticles();
    } else if (activeTab === 'notes') {
        if (typeof loadNotes === 'function') loadNotes();
    }
}
