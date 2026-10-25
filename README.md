# Western Circle of Swordfighters (WCOS)

A modern Node.js CMS application rebuilt from the original WordPress site at [vead.sg-host.com](https://vead.sg-host.com/).

The completed conversion includes 24 original pages, local imagery/fonts/styles, responsive menus, native accordions and galleries, search, and an SMTP-backed contact form. See [conversion, migration, and deployment notes](docs/site-conversion.md).

New databases are populated automatically. To replace the older sample page content in an existing installation, run `npm run migrate:site -- --replace` (a database backup is created first). Do not run it over edits you want to retain.

## 🎯 Design Overview

### Architecture
- **Pattern**: MVC (Model-View-Controller) with Service Layer
- **Framework**: Fastify (high-performance, low-overhead)
- **Template Engine**: Nunjucks (Jinja2-inspired, secure, extensible)
- **Database**: Lowdb (JSON file-based, zero-config, perfect for content sites)
- **Authentication**: JWT + HttpOnly cookies with bcrypt password hashing
- **Styling**: Custom CSS design system with CSS custom properties (no framework)

### Project Structure
```
wcos/
├── src/
│   ├── app.js                 # Application entry point
│   ├── config/index.js        # Environment configuration
│   ├── controllers/           # HTTP layer (thin, delegate to services)
│   │   ├── baseController.js
│   │   ├── homeController.js
│   │   ├── whoWeAreController.js
│   │   ├── knowledgeBaseController.js
│   │   ├── involvementController.js
│   │   ├── adminController.js
│   │   └── authController.js
│   ├── services/              # Business logic (zero HTTP knowledge)
│   │   ├── siteService.js
│   │   ├── memberService.js
│   │   ├── classesService.js
│   │   ├── movesService.js
│   │   ├── pagesService.js
│   │   └── authService.js
│   ├── models/
│   │   └── database.js        # Lowdb + Repository pattern
│   ├── middleware/
│   │   ├── auth.js            # JWT verification and session revocation
│   │   └── errorHandler.js    # Centralized error handling
│   ├── routes/
│   │   ├── publicRoutes.js    # Frontend website routes
│   │   └── adminRoutes.js     # CMS admin routes (/admin)
│   ├── utils/
│   │   └── viewEngine.js      # Nunjucks setup + filters
│   └── views/
│       ├── layouts/           # reference.njk, admin.njk
│       ├── partials/          # reference-header/footer, member-rows
│       ├── pages/             # Public page templates
│       └── admin/             # Admin panel templates
├── public/
│   ├── css/                   # reference.css, fonts.css, original/, admin.css
│   ├── js/                    # reference.js, admin.js
│   └── uploads/               # User uploads
├── data/
│   └── db.json                # Lowdb database file
├── tests/
│   ├── unit/
│   └── integration/
├── scripts/
│   ├── seed-database.js       # Populate with initial data
│   └── reset-database.js      # Reset to clean state
├── .env.example               # Environment template
├── CLAUDE.md                  # Coding standards & conventions
└── package.json
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Service Layer** | Controllers are thin; all business logic in services for testability and reuse |
| **Repository Pattern** | `BaseRepository` + specific repos = consistent data access, easy to swap DB |
| **JSON Database** | Lowdb = zero infrastructure, version-controllable, perfect for CMS content |
| **Nunjucks Templates** | Secure auto-escaping, inheritance, macros, familiar Django/Jinja syntax |
| **CSS Custom Properties** | Design tokens for colors, spacing, typography; easy theming, no build step |
| **JWT in HttpOnly Cookies** | Secure auth without localStorage XSS risk; CSRF protected via SameSite |
| **User Administration** | All authenticated users have full admin access; manage accounts under Admin → Users |

### Content Model (Mapped from Original Site)

| Entity | Fields | Source Page |
|--------|--------|-------------|
| **Member** | level, circleName, position, memberSince, region, active | Member Profiles |
| **Class** | location, day, kaiden, description, region, active | Classes |
| **Move** | name, category, description, level | Core Moves |
| **Page** | title, slug, content, published | Dynamic CMS pages |
| **Navigation** | whoWeAre[], knowledgeBase[], involvement[] | Site-wide menus |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 22.12.0 (Node 24 LTS recommended)
- **npm** ≥ 10.0.0 (or pnpm/yarn)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd wcos

# Install dependencies
npm ci

# Copy environment template
cp .env.example .env

# Edit .env with your settings (required for production)
# SESSION_SECRET, JWT_SECRET, ADMIN_EMAIL, etc.

# Start development server
npm run dev
```

The application will be available at **http://localhost:3000**

### Initial Admin Login
For an empty database, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before starting the app.
The password must contain at least 8 characters including uppercase, lowercase,
a number and a symbol, and be at most 72 UTF-8 bytes (bcrypt's limit).
The initial password is hashed with bcrypt (cost 12); it is never logged.
Remove `ADMIN_PASSWORD` from the environment after the first successful startup.
Existing databases do not require this variable or a migration.

Manage accounts in **Admin → Users**. Password fields are always empty; leave both
blank on edit to keep the existing password. Resetting a password revokes prior
sessions; resetting your own password requires signing in again. Deleting a user
revokes access immediately. Self-deletion and deleting the last account are blocked.
Public registration is disabled because every account has full administration access.

Access admin panel at **http://localhost:3000/admin**

---

## 🏃 Running the Application

### Development
```bash
# Auto-restart on file changes (Node 20+ --watch flag)
npm run dev

# Or with explicit nodemon (if preferred)
npx nodemon src/app.js
```

### Production
```bash
# Build not required (no transpilation)
NODE_ENV=production npm start

# Or with PM2 for process management
pm2 start src/app.js --name wcos
```

### Docker (Optional)
```dockerfile
# Dockerfile example
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/app.js"]
```

```bash
docker build -t wcos .
docker run -p 3000:3000 --env-file .env wcos
```

---

## 🧪 Testing

```bash
# Run all tests with coverage
npm test

# Unit tests only (fast, isolated)
npm run test:unit

# Integration tests (requires test database)
npm run test:integration

# Watch mode during development
npm test -- --watch
```

### Test Structure
```
tests/
├── unit/
│   ├── services/          # Service logic tests
│   ├── models/            # Repository tests
│   └── utils/             # Helper function tests
└── integration/
    ├── routes/            # Full HTTP request/response tests
    └── auth/              # Authentication flow tests
```

---

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with file watching |
| `npm start` | Start production server |
| `npm test` | Run all tests with coverage |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run lint` | Run ESLint on src/ |
| `npm run format` | Format code with Prettier |
| `npm run db:seed` | Populate database with initial content |
| `npm run db:reset` | Reset database to clean state |

---

## 🔧 Configuration

### Environment Variables (`.env`)

```bash
# Server
PORT=3000
NODE_ENV=development
HOST=0.0.0.0

# Session (REQUIRED in production)
SESSION_SECRET=your-64-char-random-string

# Database
DB_PATH=./data/db.json

# Admin
ADMIN_EMAIL=admin@wcos.org

# JWT (REQUIRED in production)
JWT_SECRET=your-64-char-random-string

# File Uploads
UPLOAD_DIR=./public/uploads
MAX_FILE_SIZE=10485760

# PayPal (for dues/donations)
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox

# Site
SITE_URL=http://localhost:3000
```

### Generate Secure Secrets
```bash
# Generate 64-char random strings for SESSION_SECRET and JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🗃️ Database Management

### Seed Initial Content
```bash
npm run db:seed
```
Populates database with:
- Site settings (name, email, hero text, dojos)
- Navigation menus (all 4 sections with 20+ links)
- Sample members, champions, council members
- Rank requirements (primary + steel)
- Core moves categories
- Dalmater colors
- Kaiden rules
- Resources categories
- Dues configuration

### Reset Database
```bash
npm run db:reset
```
Deletes `data/db.json` and re-seeds from scratch.

### Backup/Restore
```bash
# Backup
cp data/db.json data/db.json.backup.$(date +%Y%m%d)

# Restore
cp data/db.json.backup.20240115 data/db.json
```

---

## 🎨 Customization

### Public Layout
All public category controllers extend `PublicPageController`. Its `renderPage()` loads
published CMS content and the page-specific original CSS metadata, then renders
`pages/reference.njk` inside `layouts/reference.njk`. Shared header and footer are stored in site settings and edited in Admin → Layout.
`partials/reference-header.njk` and `partials/reference-footer.njk` provide restore defaults.

Use `public/css/reference.css` for maintained public overrides, `fonts.css` for local
fonts, and `admin.css` for admin controls. The obsolete base layout, sample public
templates, and main.css/main.js have been removed; do not recreate a second public shell.

### Add New Page Type
1. Use Pages in the CMS for ordinary content; the dynamic route uses the same renderer.
2. For a dedicated route, add a method to the appropriate category controller and call
   `this.renderPage(request, reply, 'the-page-slug')`.
3. Keep business/data transformations in services, and add route regression tests that
   verify publication rules, content, and the complete stylesheet set.
4. For member profiles, only roster rows are generated from managed records. The
   surrounding CMS page and original six-column layout remain intact. Once member
   management is used, an empty roster stays empty rather than restoring old names.

### Add New Admin Section
1. Add CRUD methods to `AdminController`
2. Create templates in `src/views/admin/`
3. Register routes in `src/routes/adminRoutes.js`

---

## 📦 Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `SESSION_SECRET` and `JWT_SECRET`
- [ ] Configure `ADMIN_EMAIL` and change default password
- [ ] Set `SITE_URL` to production domain
- [ ] Configure PayPal credentials (if using dues)
- [ ] Set up reverse proxy (nginx/Cloudflare) for SSL
- [ ] Configure `data/` directory persistence (volume/mount)
- [ ] Set up log aggregation
- [ ] Configure backup schedule for `data/db.json`

### Nginx Example
```nginx
server {
    listen 80;
    server_name wcos.org www.wcos.org;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wcos.org www.wcos.org;

    ssl_certificate /etc/letsencrypt/live/wcos.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wcos.org/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files served directly by nginx
    location /public/ {
        alias /path/to/wcos/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 🔐 Security Notes

- **Passwords**: Bcrypt with 12 rounds
- **Sessions**: HttpOnly, Secure (production), SameSite=Lax
- **CSRF**: Protected via SameSite cookie attribute
- **XSS**: Nunjucks auto-escaping + Content Security Policy ready
- **Rate Limiting**: Add `@fastify/rate-limit` for production
- **Helmet**: Add `@fastify/helmet` for security headers

---

## 📚 API Reference (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin` | Dashboard |
| GET | `/admin/pages` | List all pages |
| GET | `/admin/pages/new` | New page form |
| POST | `/admin/pages` | Create page |
| GET | `/admin/pages/:id/edit` | Edit page form |
| POST | `/admin/pages/:id/edit` | Update page |
| POST | `/admin/pages/:id/delete` | Delete page |
| GET | `/admin/members` | List members |
| GET | `/admin/settings` | Site settings |
| POST | `/admin/settings` | Update settings |
| GET/POST | `/admin/layout/:section` | Edit/save header, footer, or CSS |
| POST | `/admin/layout/:section/preview` | Preview without publishing |
| POST | `/admin/layout/:section/restore` | Restore the shipped default |

---

## 🤝 Contributing

1. **Branch**: `git checkout -b feat/your-feature-name`
2. **Develop**: Follow [CLAUDE.md](CLAUDE.md) standards
3. **Test**: `npm test` must pass
4. **Lint**: `npm run lint` must pass
5. **Commit**: Conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
6. **PR**: Open PR against `main`, squash merge after review

### Code Standards
- **SOLID Principles** — Services have single responsibility
- **Type Safety** — JSDoc types on all functions
- **Testing** — Unit tests for services, integration for routes
- **Commits** — Conventional Commits format

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- Original WordPress site by **Ventnor Web Agency**
- Content curated by **Western Circle of Swordfighters** community
- Built with **Fastify**, **Nunjucks**, **Lowdb**, and modern web standards

---

**Questions?** Check [CLAUDE.md](CLAUDE.md) for coding conventions or open an issue.

Council service is maintained on member records. See [Council membership](docs/council-membership.md) for migration and CMS filter usage.

### Shared header, footer, and navigation

Use **Admin → Layout** to edit Header, Footer, or Custom CSS. Header and Footer
reuse the Pages HTML/visual editor. Navigation links live directly in that HTML.
The saved templates support `siteName`, `siteEmail`, `currentYear`, `page.title`,
and `page.slug`; filesystem includes are not supported. Use HTML mode for dynamic
expressions, since visual edits can replace them with the preview's rendered values.

Preview does not publish. Save validates templates before replacing live content;
errors preserve your submitted source. Each section has a confirmed **Restore default**
action. Custom CSS loads after the reference styles and does not affect admin pages.
Templates use a restricted context without user records, cookies, or request objects.

On restart, an automatic migration initializes these settings from the existing
reference partials and removes the unused Navigation collection. Existing navigation
records are preserved in a `db.json.backup-layout-*` backup, not substituted for the
links already in use on the public site. Migration does not overwrite saved layout
edits. No seed/reset command is required. The source partials remain the restore defaults.

### General and council updates

**Admin → Updates** manages HTML bodies, optional titles, dates, and the General
Update/Council category. It reuses the Pages HTML/visual editor and supports category
filtering. Dates accept `YYYY-MM-DD` or `YYYY-MM` for historical month-only entries.
Updates render newest first. Original imported date labels are retained until the
date changes; no day is invented for month-only records.

Restart after merging to run the one-time migration with a `backup-updates-*`
database backup. It imports 157 general updates and seven council updates from the
supplied pages. Existing records are preserved; subsequent restarts do not restore
records you deleted or overwrite edits. No seed/reset command is necessary.

Replace the Updates page HTML with `docs/cms/updates.html` and enable its
**generalUpdates** data source. Replace WCOS Council HTML with
`docs/cms/wcos-council-updates.html` and enable **councilUpdates** and **members**.
These templates preserve the original update layout and council accordion wrappers,
icons, member cards, and static content. Pages are not overwritten automatically,
so existing CMS changes can be reviewed before pasting the replacement templates.

The **updates** data source returns all categories; **generalUpdates** and
**councilUpdates** return their respective categories. The extraction script is
`node scripts/extract-updates.mjs general.html council.html`; it regenerates the
versioned seed and templates from source HTML, not the live database.

### Settings → Data Transfer

Open **Admin → Settings → Data Transfer** (`/admin/settings/data-transfer`).

- **Export Data (.json)** includes all eight database collections: pages, members,
  classes, glossary, updates, moves, site settings/layout, and users. IDs and
  relationships are preserved. Passwords remain bcrypt hashes; sessions and
  environment credentials are excluded.
- Backup system metadata preserves the managed-roster flag and any retired `resources` data left in older databases. Restore reinstates that metadata; Populate/Override retain legacy resource entries from both databases without exposing a Resources admin section. Older backups without the roster flag restore as managed so an intentionally empty roster stays empty.
- **Export Archive (.zip)** adds all images/videos in `UPLOAD_DIR`, plus a versioned
  manifest with SHA-256 checksums and sizes. Built-in `/images` assets belong to the
  deployed codebase; external URLs remain links. ZIPs contain `database.json`,
  `manifest.json`, and `uploads/*`.
- Upload either format, choose a mode, inspect validation results and counts, then
  explicitly confirm. The preview never changes the live database. Imports fail
  if the database or uploaded files changed after preview; upload again to review.

**Populate** adds missing IDs and retains matching records. **Override** replaces
matching IDs and adds new records while retaining records omitted from the file.
**Restore** replaces all collections and requires all collections in the snapshot.
Site settings are a singleton matched as one record, regardless of its ID.
JSON imports always retain existing uploaded files; ZIP Restore replaces the
uploads directory with the snapshot. Missing referenced local media blocks imports.
For Populate/Override archives, identical media is reused; conflicting names receive
a content-based suffix and imported record/HTML references are rewritten. No member
is matched by name: relationships use stable IDs and invalid references are errors.

The importer validates schema version 1, collection shapes/IDs, required fields,
dates, duplicate slugs/emails/championship years, member relationships, page parents,
layout templates, local media references, file signatures, and manifest checksums.
User records require valid bcrypt hashes; the importer never accepts plaintext
passwords. A resulting database must have at least one administrator. Changed user
credentials revoke existing sessions; Restore revokes all prior user sessions.
The importing user signs in again after any successful import.

**Limits:** 128 MiB input/output archive or JSON file, 256 MiB expanded content,
5,000 archive entries, 50,000 records per collection. Supported uploaded files are
PNG, JPEG, GIF, WebP, MP4, MOV, and WebM. Archive directory entries, symlinks,
path traversal, encrypted/multi-volume/ZIP64 archives, unknown files, and unsupported
versions are rejected. Use archives produced by this app. Transfers buffer data
within these limits; allow enough memory and disk space for staging and backups.
At most 20 previews can be pending; they expire after 30 minutes and are cleaned on
Data Transfer requests. Private stages are bound to the user and browser session.

Before applying, a complete recovery archive is saved beside `DB_PATH` in
`.wcos-transfer/backups/` with private file permissions. It can be downloaded from
Data Transfer and imported as Restore. Backups are retained until an operator removes
them from disk. Protect backups as carefully as the database itself.

During commit, the app serializes database writes and prevents reads from seeing an
incomplete media/database swap. A private journal enables rollback after a write
failure and recovery before startup serves requests following an interruption.
If storage failure prevents rollback, requests are blocked until recovery succeeds.
Use a **single app process** for this Lowdb database and stop the app before running
maintenance scripts against the same storage. Multiple processes/external writers
cannot be coordinated by the in-process lock. Allow sufficient free disk space for
the recovery archive plus old and staged media directories. Do not delete a pending
`.wcos-transfer/transaction.json` or `.wcos-import-*` directory during recovery.

Deployment: run `npm install` (or `npm ci`) for the added `fflate` dependency, then
restart. No database migration or new environment variables are required.

### Railway HTTPS and import sessions

Railway terminates HTTPS before forwarding requests to the app. When
`RAILWAY_ENVIRONMENT_ID` is present, WCOS trusts one proxy hop so secure session
cookies work for admin form tokens and import previews. Set `TRUST_PROXY=1` for
an equivalent single trusted proxy, or `TRUST_PROXY=0` to disable this behavior.
After deploying this fix, reload Data Transfer to obtain a fresh form token.
Expired form tokens are still rejected; the upload screen now displays plain-text
server errors rather than a JSON parsing error.

### Create or reset the configured administrator

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` or the process environment, then run:

```bash
npm run admin:reset
```

The command creates the account if its email does not exist, or resets that
account's password and revokes its previous login sessions. Email matching is
case-insensitive; existing names and other accounts are preserved. The password
must meet the application's password rules and is never printed. Missing or
invalid credentials cause a nonzero exit. `ADMIN_EMAIL` defaults to `admin@wcos.org`.

Stop the app before running this maintenance command against its JSON database,
then restart it afterward. Use the same `DB_PATH` as the app; on Railway, run
against the mounted volume, not a local database. Remove `ADMIN_PASSWORD` from
the environment once the account has been set up or reset.
