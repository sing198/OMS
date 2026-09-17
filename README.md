# DGKeys

DGKeys is a game key storefront built as a portfolio project. It has a React frontend, a Go API, and a PostgreSQL database.

Customers can browse games, keep a cart, apply coupons, and view their orders. Admins can manage products, upload images, update order statuses, and suspend accounts. Super admins can also change user roles and read the admin activity log. The interface includes Thai and English translations.

Checkout currently creates a pending order and reserves stock. Payment confirmation is manual; there is no payment gateway or automatic key delivery yet.

## Running locally

You need Go 1.26.5 or later, Node.js 24 (the version in `.nvmrc`), and a PostgreSQL database. Supabase works too if you prefer a hosted database.

```bash
git clone https://github.com/sing198/OMS.git
cd OMS
```

### Backend

```bash
cd oms-backend
cp .env.example .env
```

Set `DATABASE_URL` to your database connection string. Generate a secret with the command below and use its output as `JWT_SECRET`:

```bash
openssl rand -hex 32
```

The server requires a secret of at least 32 bytes. It creates or updates the database tables on startup, so use a development database when trying it out.

```bash
go run .
```

The API runs on `http://localhost:8080`. You can check it at `/ping`. Uploaded images are saved in `oms-backend/uploads/`.

### Frontend

Open another terminal from the repository root:

```bash
cd oms-frontend
nvm use
cp .env.example .env
npm ci
npm run dev
```

If you don't use nvm, install Node.js 24 before running these commands and skip `nvm use`.

Open `http://localhost:5173`. The frontend uses `VITE_API_URL` from `.env`, which defaults to `http://localhost:8080`.

New accounts have the `customer` role. To try the admin pages, register an account and change that account's role to `superadmin` directly in your development database. There is no seeded admin account.

## Code layout

- `oms-backend/main.go` — models, authentication, and most API routes.
- `oms-backend/orders.go` — order validation, pricing, and stock reservation.
- `oms-backend/security_test.go` — authentication and order regression tests.
- `oms-frontend/src/pages/` — storefront and admin pages.
- `oms-frontend/src/locales/` — Thai and English translation files.
- `screenshots/` — screenshots of the application.

The frontend uses React, Vite, Tailwind CSS, Axios, and i18next. The backend uses Gin for HTTP routes and GORM for database access.

Passwords are hashed with bcrypt. Authentication uses JWTs, but account status and roles are read from the database on each authenticated request, so a ban or role change applies to existing sessions.

Order creation runs inside a database transaction. Product rows are locked in ID order before stock is checked and reduced. If a write or the commit fails, the API returns an error instead of confirming the order.

## Checks

From `oms-backend/`:

```bash
go test -race ./...
go vet ./...
```

The tests use SQL mocks. They cover invalid quantities, unavailable stock, transaction failures, and account permissions; they do not replace integration tests against PostgreSQL.

From `oms-frontend/`:

```bash
npm run build
npm run lint
```

The build passes. Project-wide lint still reports issues in several existing pages, and dependency audit findings remain to be addressed.

## Still to do

- Connect payment verification and key delivery.
- Add expiry and stock release for abandoned pending orders. Stock reservations currently need manual follow-up.
- Add integration tests with PostgreSQL and browser tests for checkout.
- Resolve the remaining lint and dependency audit findings.

## Screenshots

These screenshots were taken before the checkout changes. The current checkout creates a pending order and no longer shows the mock payment QR code.

![Product catalog](screenshots/homepage.png)

<details>
<summary>Storefront pages</summary>

### Product details

![Product details](screenshots/ProductDetails.png)

### Cart

![Cart](screenshots/cart.png)

### Checkout (earlier version)

![Earlier checkout screen](screenshots/checkout.png)

### Order history

![Order history](screenshots/myOrders.png)

</details>

<details>
<summary>Admin pages</summary>

### Products

![Product management](screenshots/AdminProducts.png)

### Orders

![Order management](screenshots/AdminOrders.png)

### Users

![User management](screenshots/AdminUsers.png)

### Coupons

![Coupon management](screenshots/AdminCoupons.png)

</details>
