# 🧁 Bakesale — Billing Management System

## Tech Stack
- **Backend:** Django 4.2 + Django REST Framework + JWT Auth
- **Frontend:** React 18 + React Router 6
- **Database:** SQLite (dev) / PostgreSQL (production)

---

## 📁 Project Structure

```
bakesale/
├── backend/
│   ├── bakesale/           ← Django project settings
│   │   ├── settings.py
│   │   └── urls.py
│   ├── api/                ← Main app
│   │   ├── models.py       ← All data models
│   │   ├── serializers.py  ← DRF serializers
│   │   ├── views.py        ← API views
│   │   ├── urls.py         ← API routes
│   │   ├── permissions.py  ← Role-based access
│   │   └── management/commands/create_default_admin.py
│   ├── requirements.txt
│   ├── manage.py
│   └── .env.example
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js           ← Root with routing
    │   ├── index.js
    │   ├── index.css        ← Global styles
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── services/
    │   │   └── api.js       ← All API calls (axios)
    │   ├── pages/
    │   │   ├── Login.js
    │   │   ├── Sale.js      ← Full billing module
    │   │   ├── Purchase.js  ← Create products + record purchases
    │   │   ├── Reports.js   ← Sale + item-wise reports
    │   │   ├── Stock.js     ← Stock status with filters
    │   │   └── AdminPanel.js← User management
    │   └── components/
    │       ├── Layout.js    ← Navbar + page shell
    │       └── PrintBill.js ← Printable bill receipt
    ├── package.json
    └── .env
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/token/` | Login → JWT tokens |
| POST | `/api/token/refresh/` | Refresh access token |
| GET | `/api/products/` | List all products |
| POST | `/api/products/` | Create product |
| GET | `/api/products/search/?q=` | Search by name/barcode |
| GET | `/api/products/by_barcode/?barcode=` | Exact barcode lookup |
| GET | `/api/products/stock_status/` | Full stock report |
| GET | `/api/purchases/` | List purchases |
| POST | `/api/purchases/` | Record purchase (updates stock) |
| GET | `/api/bills/` | List bills (paginated) |
| POST | `/api/bills/` | Create bill (deducts stock) |
| GET | `/api/bills/{id}/` | Get bill with items |
| GET | `/api/bills/sale_report/` | Sale report (with totals) |
| GET | `/api/bills/item_wise_report/` | Item-wise sales |
| GET | `/api/returns/` | List returns |
| POST | `/api/returns/` | Process return |
| GET | `/api/users/` | List users (admin only) |
| POST | `/api/users/` | Create user (admin only) |
| PATCH | `/api/users/{id}/` | Update user (admin only) |
| DELETE | `/api/users/{id}/` | Delete user (admin only) |
| GET | `/api/users/me/` | Current user info |

---

## ⚙️ Backend Setup

### 1. Prerequisites
- Python 3.10+
- pip

### 2. Create virtual environment
```bash
cd bakesale/backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment
```bash
cp .env.example .env
# Edit .env if needed (defaults work for SQLite development)
```

### 5. Run migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Create default admin user
```bash
python manage.py create_default_admin
# Creates: username=admin, password=admin123
```

### 7. Start the backend server
```bash
python manage.py runserver
# Runs at http://localhost:8000
```

---

## ⚛️ Frontend Setup

### 1. Prerequisites
- Node.js 18+
- npm or yarn

### 2. Install dependencies
```bash
cd bakesale/frontend
npm install
```

### 3. Configure API URL
The `.env` file already points to `http://localhost:8000/api`.
Change it if your backend runs on a different port.

### 4. Start the frontend
```bash
npm start
# Opens at http://localhost:3000
```

---

## 🔑 Default Login

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |
| Role | Admin |

> ⚠️ Change this password after first login via Admin Panel.

---

## 🗄️ Using PostgreSQL (Production)

### 1. Create database
```sql
CREATE DATABASE bakesale;
CREATE USER bakesale_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE bakesale TO bakesale_user;
```

### 2. Update .env
```env
USE_POSTGRES=True
DB_NAME=bakesale
DB_USER=bakesale_user
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432
```

### 3. Run migrations again
```bash
python manage.py migrate
```

---

## 💡 How to Use Each Module

### 🛒 Sale
1. Type a product name or scan a barcode — a dropdown preview appears
2. Click a row or press **Enter** to add to bill
3. Adjust quantities with +/− buttons
4. Click **Cash / Card / UPI** to instantly save the bill
5. For **Cash & Card** split — enter amounts in the modal
6. A print preview appears — click Print or Skip
7. Use **View Bills** to reprint old receipts
8. Use **Return** to process returns (adjusts stock accordingly)

### 📦 Purchase
1. Click **Create Product** to add new items (barcode auto-generates if none)
2. Scan a product barcode → enter MRP, purchase price, tax, quantity
3. Save → stock is automatically increased

### 📊 Reports
- **Sale Report**: all bills with per-payment-type totals
- **Item-wise Report**: product-level sales data
- Use date filters to narrow results

### 🗃️ Stock
- View all products with current stock, damaged, expired counts
- Filter by: In Stock, Out of Stock, Low Stock (≤5), Damaged, Expired

### ⚙️ Admin Panel (Admin only)
- Create, edit, delete users
- Assign roles: Admin or General

---

## 🔒 Role Permissions

| Feature | Admin | General |
|---------|-------|---------|
| Sale | ✅ | ✅ |
| Purchase | ✅ | ✅ |
| Reports | ✅ | ✅ |
| Stock | ✅ | ✅ |
| Admin Panel | ✅ | ❌ |
| User Management | ✅ | ❌ |

---

## 🐛 Troubleshooting

**CORS errors**: Make sure Django is running on port 8000 and frontend on 3000. CORS is already configured for all origins in development.

**Token errors**: Try logging out and logging in again. JWT tokens expire after 12 hours.

**`Module not found` in React**: Run `npm install` again inside the `frontend/` folder.

**`No module named 'api'`**: Make sure you're running `python manage.py` from inside the `backend/` folder.

**Migrations error**: Delete `db.sqlite3` and `api/migrations/` (except `__init__.py`) and re-run `makemigrations` + `migrate`.
