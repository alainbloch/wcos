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
│   │   ├── resourcesController.js
│   │   ├── adminController.js
│   │   └── authController.js
│   ├── services/              # Business logic (zero HTTP knowledge)
│   │   ├── siteService.js
│   │   ├── memberService.js
│   │   ├── classesService.js
│   │   ├── movesService.js
│   │   ├── resourcesService.js
│   │   ├── pagesService.js
│   │   └── authService.js
│   ├── models/
│   │   └── database.js        # Lowdb + Repository pattern
│   ├── middleware/
│   │   ├── auth.js            # JWT verification, role guards
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
| **Role-Based Access** | `admin` vs `editor` roles; route-level guards via middleware |

### Content Model (Mapped from Original Site)

| Entity | Fields | Source Page |
|--------|--------|-------------|
| **Member** | level, circleName, position, memberSince, region, active | Member Profiles |
| **Champion** | year, name, title, image | Hall of Heroes |
| **CouncilMember** | name, title, image, current, historicalDate | WCOS Council |
| **Class** | location, day, kaiden, description, region, active | Classes |
| **Rank** | type (primary/steel), level, name, description, requirements[] | Rank Requirements |
| **CoreMove** | name, category, description, level | Core Moves |
| **DalmaterColor** | kaiden, color, kaidenOrder, isRedDalmater, requirements[] | Dalmater Colors |
| **Kaiden** | section (theWay/rules/documents), number, title, content | Kaidens |
| **Resource** | category, name, url, description | Links & Resources |
| **Dues** | amountOptions, rankOptions, dojoOptions, paypalEmail, nonProfit, memberContributions, donateText | Dues |
| **Page** | title, slug, content, published | Dynamic CMS pages |
| **Navigation** | whoWeAre[], knowledgeBase[], involvement[], resources[] | Site-wide menus |

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

### Default Admin Login
After first run, an admin user is created:
- **Email**: `admin@wcos.org` (from `.env` ADMIN_EMAIL)
- **Password**: `admin123` ⚠️ **Change immediately!**

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
`pages/reference.njk` inside `layouts/reference.njk`. Shared navigation and footer
live in `partials/reference-header.njk` and `partials/reference-footer.njk`.

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
| POST | `/admin/settings/navigation` | Update navigation |

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
