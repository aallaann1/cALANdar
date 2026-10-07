# Architecture cALANdar

L'application est divisée en deux parties (Frontend et Backend) orchestrées par Docker et Docker Compose.

## 1. Backend (Python / FastAPI)
- **FastAPI** : Fournit une API RESTful rapide et asynchrone.
- **SQLAlchemy** : ORM pour interagir avec la base de données PostgreSQL.
- **JWT (JSON Web Tokens)** : Pour l'authentification et la sécurisation des routes.
- **Bcrypt** : Pour le hashage sécurisé des mots de passe.
- **iCalendar** : Pour la génération dynamique des flux `.ics`.
- **smtplib/EmailMessage** : Pour l'envoi d'emails HTML (via Mailhog en développement).

### Structure
* `app/models/` : Définition des tables (Users, Teams, Events, ShiftTypes, Invitations).
* `app/routers/` : Endpoints de l'API.
* `app/schemas/` : Validation des données entrantes/sortantes avec Pydantic.
* `app/core/` : Configuration, sécurité et connexion BDD.

## 2. Frontend (Vue.js 3 / Tailwind CSS)
- **Vue.js 3** : Utilisé via CDN pour une architecture SPA (Single Page Application) légère et réactive, sans compilation complexe nécessaire.
- **Tailwind CSS** : Utilisé pour rendre l'interface responsive (utilisable sur mobile) et esthétique.
- **FullCalendar.js** : Intégration pour l'affichage interactif des plannings (vues semaine, mois, jour).

### Fichiers
* `index.html` : L'interface principale avec onglets dynamiques (Planning, Profil, Gestion, Admin).
* `app.js` : Logique applicative, appels API, et rendu du calendrier.
* `invite.html` : Page d'atterrissage pour les invitations avec formulaire de création de compte.

## 3. Base de données & Services (Docker)
Le fichier `docker-compose.yml` définit 4 services :
1. **db** : PostgreSQL 15.
2. **backend** : L'API FastAPI fonctionnant sur Uvicorn (Port 8000).
3. **frontend** : Serveur Nginx servant les fichiers statiques (Port 8080).
4. **mailhog** : Serveur SMTP de test pour intercepter les emails d'invitation (Interface web sur le port 8025).

## Fonctionnalités implémentées :
* **Rôles** : Utilisateur, Gestionnaire (`is_manager`), Admin (`is_admin`). L'admin `alanterrier11@gmail.com` est auto-créé avec le mot de passe `1234`.
* **Invitations** : Création de liens d'invitation uniques (valables 24h). Envoi d'email via un template HTML.
* **Planning** : Ajout d'heures par le gestionnaire (choix du collaborateur, type de shift, heures).
* **iCal** : Génération de liens dynamiques en temps réel pour synchronisation externe.
* **Sécurité** : Pas de formulaire d'inscription public, mots de passe hashés, routes protégées.
