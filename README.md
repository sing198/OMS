<div align="center">

# 🎮 DGKeys

### Digital Game Key E-Commerce Platform

A production-grade full-stack web application for buying and selling digital game keys — built from scratch with **Golang**, **React**, and **PostgreSQL**.

[![Go](https://img.shields.io/badge/Go-1.20+-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://go.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

## 📌 Overview

**DGKeys** is a complete e-commerce system designed for digital game key distribution. The project demonstrates end-to-end full-stack development — from designing a responsive storefront UI to building a secure RESTful API with role-based access control and transactional database operations.

> **Built as a portfolio project** to showcase proficiency in modern web technologies, API design, authentication systems, and database concurrency handling.

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🛒 Customer Experience
- JWT-based authentication (Login / Register)
- Product browsing with real-time search & filtering
- Platform categorization (Steam, Epic, PlayStation, Xbox)
- Paginated product catalog
- Shopping cart with persistent storage
- Coupon/discount code system at checkout
- Order history with status tracking
- Multi-language support (EN / TH)

</td>
<td width="50%">

### ⚙️ Admin Dashboard
- Role-Based Access Control (RBAC) — Admin & Super Admin
- Full CRUD product management with image upload
- Order status management (Paid → Shipped → Delivered)
- User management — role promotion, account suspension
- Coupon creation & management
- Admin activity logging & audit trail
- System metrics overview

</td>
</tr>
</table>

---

## 🏗️ Architecture & Technical Highlights

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│              React + Vite + Tailwind CSS                 │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTP/REST (Axios)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   API Server (Go)                        │
│              Gin Framework + JWT Auth                    │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐    │
│  │   Auth   │  │  Admin   │  │  Order Processing  │    │
│  │Middleware│  │  RBAC    │  │  (TX + Row Lock)   │    │
│  └──────────┘  └──────────┘  └────────────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │  GORM ORM
                       ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL (Supabase)                        │
│     Users · Products · Orders · Coupons · AdminLogs      │
└─────────────────────────────────────────────────────────┘
```

### 🔒 Security & Concurrency

| Concern | Implementation |
|---------|---------------|
| **Authentication** | JWT tokens with expiration, bcrypt password hashing |
| **Authorization** | Middleware-based RBAC (User / Admin / Super Admin) |
| **Race Conditions** | PostgreSQL `SELECT ... FOR UPDATE` row-level locking during checkout |
| **Input Validation** | Server-side validation on all endpoints, file type/size checks on uploads |
| **CORS** | Configured cross-origin policies for frontend-backend communication |

### ⚡ Performance Decisions

- **Paginated API responses** — prevents loading entire datasets; supports `page`, `limit`, and `search` query parameters
- **Optimistic cart validation** — cart items verified against live stock data before checkout
- **Environment-based configuration** — `VITE_API_URL` for seamless local/staging/production deployments
- **Transaction-scoped operations** — stock deduction and order creation happen atomically within a single DB transaction

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 8, Tailwind CSS, React Router DOM, Axios, i18next |
| **Backend** | Go 1.20+, Gin Web Framework, GORM ORM |
| **Database** | PostgreSQL (hosted on Supabase) |
| **Auth** | JSON Web Tokens (JWT), bcrypt |
| **Notifications** | React Hot Toast |
| **File Storage** | Local uploads with validation (extensible to S3/Cloudinary) |

---

## 📸 Screenshots

### Customer Experience

<details>
<summary><strong>🏠 Homepage — Product Catalog & Filtering</strong></summary>
<br>

![Homepage](screenshots/homepage.png)

</details>

<details>
<summary><strong>🔍 Product Details</strong></summary>
<br>

![Product Details](screenshots/ProductDetails.png)

</details>

<details>
<summary><strong>🛒 Shopping Cart</strong></summary>
<br>

![Shopping Cart](screenshots/cart.png)

</details>

<details>
<summary><strong>💳 Checkout & Coupon System</strong></summary>
<br>

![Checkout](screenshots/checkout.png)

</details>

<details>
<summary><strong>📦 Order History & Tracking</strong></summary>
<br>

![My Orders](screenshots/myOrders.png)

</details>

### Admin Dashboard

<details>
<summary><strong>📊 Product Management (CRUD)</strong></summary>
<br>

![Admin Products](screenshots/AdminProducts.png)

</details>

<details>
<summary><strong>📋 Order Management & Status Updates</strong></summary>
<br>

![Admin Orders](screenshots/AdminOrders.png)

</details>

<details>
<summary><strong>👥 User Management & Role Control</strong></summary>
<br>

![Admin Users](screenshots/AdminUsers.png)

</details>

<details>
<summary><strong>🎟️ Coupon Management</strong></summary>
<br>

![Admin Coupons](screenshots/AdminCoupons.png)

</details>

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **Go** v1.20+
- **PostgreSQL** database (or [Supabase](https://supabase.com) free tier)

### 1. Clone the repository

```bash
git clone https://github.com/sing198/OMS.git
cd OMS
```

### 2. Backend Setup

```bash
cd oms-backend

# Install Go dependencies
go mod tidy

# Configure environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Start the server
go run main.go
# → API running at http://localhost:8080
```

### 3. Frontend Setup

```bash
cd oms-frontend

# Install dependencies
npm install

# Start development server
npm run dev
# → App running at http://localhost:5173
```

---

## 📁 Project Structure

```
OMS/
├── oms-backend/
│   ├── main.go              # API routes, middleware, handlers
│   ├── go.mod               # Go module dependencies
│   └── uploads/             # Uploaded product images
│
├── oms-frontend/
│   ├── src/
│   │   ├── pages/           # React page components
│   │   │   ├── Products.jsx        # Product catalog
│   │   │   ├── ProductDetail.jsx   # Single product view
│   │   │   ├── Cart.jsx            # Shopping cart
│   │   │   ├── Checkout.jsx        # Checkout & payment
│   │   │   ├── MyOrders.jsx        # Order history
│   │   │   ├── AdminDashboard.jsx  # Product CRUD
│   │   │   ├── AdminOrders.jsx     # Order management
│   │   │   ├── AdminUsers.jsx      # User management
│   │   │   ├── AdminCoupons.jsx    # Coupon management
│   │   │   └── AdminLogs.jsx       # Audit trail
│   │   ├── App.jsx          # Router & protected routes
│   │   └── i18n.js          # Internationalization config
│   └── package.json
│
├── screenshots/             # README screenshots
└── README.md
```

---

## 📝 License

This project was built for **educational and portfolio purposes**.  
Feel free to explore the code and reach out if you have questions.

<div align="center">

---

**Built with 🤍 by [sing198](https://github.com/sing198)**

</div>
