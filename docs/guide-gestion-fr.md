# Panneau de gestion - Guide complet

## Votre atelier, simplifié.

Le panneau de gestion est le coeur de votre administration. Il centralise la gestion de vos employés, de vos véhicules, du suivi en temps réel des travaux, des médias et de la facturation. Accessible depuis n'importe quel navigateur, il vous donne un contrôle total sur les opérations de votre atelier.

---

## Accès sécurisé

Le panneau est protégé par un mot de passe et une authentification à deux facteurs (2FA). Lors de la connexion, un code à 6 chiffres est envoyé par courriel. Vous pouvez cocher l'option "Ne plus demander pendant 30 jours" pour simplifier vos connexions fréquentes.

Après plusieurs tentatives échouées, l'accès est temporairement verrouillé pour protéger votre compte.

---

## Vue d'ensemble

Le panneau de gestion contient 5 sections principales :

| Section | Description |
|---------|-------------|
| **Employés** | Gérer votre équipe et leurs badges NFC |
| **Voitures** | Répertoire complet de tous les véhicules |
| **Monitoring** | Suivi en temps réel des bons de travail |
| **Médias** | Photos et documents liés aux véhicules |
| **Dashboard** | Scanner NFC plein écran pour le poste de travail |

Une cloche de notifications en haut à droite vous informe en temps réel de toute activité : nouveau bon de travail, pause, reprise, fin de travail.

---

## 1. Employés

### Ajouter un employé
Cliquez sur **"Nouvel employé"** et remplissez :
- Prénom et nom
- Date d'embauche
- Badge NFC (optionnel, peut être assigné plus tard)

### Liste des employés
La liste affiche tous vos employés avec leur date d'embauche et le statut de leur badge NFC (assigné ou non assigné). Chaque employé a 4 actions rapides :

- **Statistiques** (icône graphique) : Voir les performances de l'employé
- **Heures facturées** (icône horloge) : Gérer les heures facturées mensuelles
- **Modifier** (icône crayon) : Modifier les informations de l'employé
- **Supprimer** (icône poubelle) : Retirer l'employé du système

### Statistiques d'un employé
En cliquant sur le nom d'un employé ou sur l'icône de statistiques, vous accédez à un tableau de bord détaillé :

**Filtres de période :**
- Aujourd'hui, Cette semaine, Ce mois, Cette année, Tout
- Sélecteur de mois spécifique (ex: Mars 2026, Février 2026...)

**Cartes de statistiques :**
- **Heures travaillées** : Total des heures punchées pour la période
- **Heures facturées** : Total des heures facturées au client pour la période
- **Efficacité** : Ratio heures facturées / heures travaillées en pourcentage
  - Vert : 80% et plus
  - Orange : entre 50% et 79%
  - Rouge : moins de 50%
- **Véhicules** : Nombre de véhicules travaillés
- **Temps moyen / véhicule** : Durée moyenne par véhicule

**Historique récent :** Tableau paginé montrant chaque bon de travail avec la date, le véhicule et la durée.

### Heures facturées
L'icône horloge ouvre le gestionnaire d'heures facturées. C'est ici que vous entrez les heures que l'employé a facturé aux clients.

**Ajouter une entrée :**
1. Sélectionnez le mois (par défaut le mois précédent)
2. Entrez le nombre d'heures facturées
3. Ajoutez une note optionnelle (ex: "vacance 1 semaine", "overtime")
4. Cliquez **Ajouter**

**Modifier une entrée :** Cliquez sur l'icône crayon, modifiez les valeurs, puis cliquez **Modifier**.

**Supprimer une entrée :** Cliquez sur l'icône poubelle rouge.

Le tableau affiche toutes les entrées par mois, du plus récent au plus ancien.

### Badges NFC
Chaque employé peut avoir un badge NFC assigné. Ce badge sert à "puncher" les bons de travail via le scanner. Pour assigner un badge :
1. Modifiez l'employé ou créez-en un nouveau
2. Cliquez sur **Scanner**
3. Passez le badge NFC devant le lecteur
4. Le badge est automatiquement associé

Pour retirer un badge, cliquez sur **Retirer** dans le formulaire de modification.

---

## 2. Voitures

### Ajouter un véhicule
Cliquez sur **"Nouveau véhicule"** et remplissez les informations :
- **Propriétaire** (obligatoire) et coordonnées (téléphone, courriel)
- **Référence** : numéro de dossier interne
- **Marque** (obligatoire), modèle, année, couleur
- **Plaque d'immatriculation** et **NIV (VIN)**
- **Photo du véhicule** : ajoutez une photo pour identifier rapidement le véhicule
- **Badge NFC** : assignez un badge directement au véhicule (optionnel)

### Liste des véhicules
La liste affiche tous les véhicules avec une barre de recherche pour filtrer rapidement. Chaque véhicule montre :
- Marque, modèle et année
- Nom du propriétaire et plaque
- Statut (en cours, en pause, ou inactif)
- Nombre de médias assignés
- Actions : Détail, Modifier, Supprimer

### Fiche détaillée d'un véhicule
En cliquant sur le nom d'un véhicule, vous ouvrez sa fiche complète :

- **Photo et informations** : toutes les données du véhicule
- **Bon de travail actif** : si le véhicule est en cours de travail, un chronomètre en temps réel affiche la durée, l'employé assigné et le statut (en cours ou en pause)
- **Statistiques** : nombre total de réparations, temps total et nombre d'employés
- **Historique des travaux** : tableau paginé de tous les bons de travail passés
- **Médias** : photos et documents liés au véhicule avec possibilité de copier le lien de partage
- **Notes** : ajoutez, consultez et supprimez des notes internes sur le véhicule

---

## 3. Monitoring

Le monitoring est le centre de contrôle en temps réel de votre atelier.

### Indicateur "En direct"
Un point vert pulsant confirme que les données se rafraîchissent automatiquement toutes les 5 secondes.

### Bons de travail en cours
Chaque bon de travail actif affiche :
- **Chronomètre en temps réel** : durée écoulée mise à jour chaque seconde
- **Véhicule** : marque, modèle et plaque
- **Employé** : nom de l'employé assigné
- **Statut** : En cours (bande ambre) ou En pause (bande verte)
- **Actions** :
  - **Pause/Reprendre** : mettre en pause ou reprendre le bon
  - **Arrêter** : terminer le bon de travail

### Pause automatique
Le système gère automatiquement les pauses selon l'horaire configuré. Par exemple :
- Pause automatique à midi (heure du diner)
- Reprise automatique à 13h
- Pause automatique à 17h (fin de journée)
- Reprise automatique le lendemain matin

Les actions automatiques sont identifiées par le suffixe **(sys)** dans les notifications.

### Activité récente
Un fil d'activité montre les derniers bons de travail terminés avec leur durée totale.

---

## 4. Médias

La section médias permet de gérer toutes les photos et documents de votre atelier.

### Photos non classées
Les nouvelles photos apparaissent dans la section **"Nouveau"**. Un badge indique le nombre de médias non classés.

### Classer des photos
1. Cliquez sur **"Classer"** pour activer le mode de classement
2. Sélectionnez les photos à classer (un compteur indique le nombre sélectionné)
3. Recherchez le véhicule dans le champ de recherche (filtrage instantané)
4. Cliquez **"Assigner"** pour associer les photos au véhicule

### Photos classées
Les photos classées sont regroupées par véhicule. Le nom du véhicule est cliquable et mène directement à sa fiche détaillée. Chaque groupe affiche un badge avec le nombre de photos.

### Supprimer des médias
1. Cliquez sur l'icône poubelle pour activer le mode suppression
2. Sélectionnez les photos à supprimer
3. Confirmez la suppression

### Partage
Chaque photo peut être partagée via un lien direct. Cliquez sur l'icône de copie pour copier le lien dans le presse-papier.

---

## 5. Dashboard (Scanner NFC)

Le Dashboard est concu pour être affiché en permanence sur un poste de travail dans l'atelier.

### Scanner plein écran
Cliquez sur **"Ouvrir le scanner"** pour passer en mode plein écran. Ce mode est optimisé pour l'utilisation quotidienne :

1. L'écran attend un scan NFC
2. Un employé passe son badge devant le lecteur
3. Le système identifie l'employé et affiche son nom
4. L'employé passe le badge d'un véhicule
5. Le bon de travail est automatiquement créé ou fermé

**Si l'employé a déjà un bon de travail actif sur ce véhicule**, le scan le ferme automatiquement.

**Si l'employé n'a pas de bon de travail actif**, le scan en crée un nouveau.

### Configuration du lecteur NFC
Le Dashboard affiche l'état de connexion du lecteur NFC :
- **Vert** : lecteur connecté et prêt
- **Rouge** : lecteur déconnecté

Instructions d'installation incluses directement dans l'interface :
1. Installer le driver ACR122U
2. Télécharger l'application NFC Reader
3. Brancher le lecteur USB
4. Lancer NFC Reader

Option de démarrage automatique avec Windows incluse.

---

## Notifications

### Cloche de notifications
En haut à droite, une cloche affiche un badge rouge avec le nombre de nouvelles notifications. Cliquez dessus pour voir la liste :

- **Bon commencé** : un nouveau bon de travail a été ouvert
- **Bon terminé** : un bon de travail a été complété
- **Bon en pause** : un bon de travail a été mis en pause
- **Bon repris** : un bon de travail a repris après une pause

Les notifications automatiques (pause/reprise programmée) sont identifiées par **(sys)**.

### Préférences de notification
Dans la section **Configuration**, vous pouvez activer ou désactiver chaque type de notification individuellement. Les notifications restent enregistrées dans l'historique même si elles sont désactivées.

### Historique des notifications
Accessible depuis **Configuration > Historique des notifications**, l'historique affiche un tableau complet et paginé de toutes les notifications passées avec :
- Date et heure
- Type (coloré par catégorie)
- Titre et détail
- Indicateur système (sys) pour les actions automatiques

---

## Configuration

La section Configuration regroupe les réglages du système :

### Sécurité
- **Vérification 2FA** : activer ou désactiver l'authentification à deux facteurs

### Horaire de pause
Définissez les plages horaires de travail pour chaque jour de la semaine. Chaque jour est repliable pour économiser l'espace. Cliquez sur la flèche pour déplier un jour et modifier ses plages horaires.

Exemple de configuration :
- Lundi à Vendredi : 8h00-12h00, 13h00-17h00
- Samedi : 9h00-12h00
- Dimanche : Fermé

Le système utilisera ces horaires pour déclencher automatiquement les pauses et les reprises.

### Notifications
Choisissez quels types de notification apparaissent dans la cloche :
- Bon de travail commencé
- Bon de travail terminé
- Bon mis en pause
- Bon repris

### Historique des notifications
Consultez l'historique complet de toutes les alertes et notifications du système.

---

## En résumé

| Fonctionnalité | Ce que ca fait |
|----------------|---------------|
| Gestion des employés | Ajouter, modifier, supprimer, assigner des badges NFC |
| Statistiques employé | Heures travaillées, facturées, efficacité, historique |
| Heures facturées | Entrée mensuelle, modification, notes |
| Gestion des véhicules | Fiche complète avec photo, historique, notes, médias |
| Monitoring temps réel | Chronomètres en direct, pause/reprise manuelle |
| Pause automatique | Gestion intelligente selon l'horaire configuré |
| Scanner NFC | Punch rapide des bons de travail par badge |
| Gestion des médias | Upload, classement par véhicule, partage |
| Notifications | Alertes en temps réel avec historique complet |
| Configuration | 2FA, horaires, préférences de notification |

---

*Ce système est concu pour simplifier la gestion quotidienne de votre atelier mécanique. Tout est centralisé, automatisé et accessible en temps réel.*
