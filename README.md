# Fleet Budget Dashboard

Multi-vessel budget management system for tracking and controlling fleet operational expenditure.

## Features

- **Role-based access**: Admin (shore staff) and Vessel user roles
- **Fleet overview**: See all vessels' budget performance at a glance
- **Per-vessel dashboards**: Budget vs actual, spending alerts, indent tracking
- **Budget management**: Set and update annual budgets by category/sub-category
- **Indent tracking**: HO and Outport indents with status workflow
- **Spending alerts**: Automatic warnings based on pro-rata weekly targets
- **User management**: Create/manage admin and vessel accounts

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + Recharts
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Auth**: JWT tokens

---

## Deploy to Railway (Recommended)

### Step 1: Create a Railway Account
1. Go to [railway.app](https://railway.app) and sign up
2. Connect your GitHub account

### Step 2: Push Code to GitHub
```bash
cd fleet-budget
git init
git add .
git commit -m "Initial commit - Fleet Budget Dashboard"
```
Create a new repo on GitHub, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/fleet-budget-dashboard.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy on Railway
1. In Railway dashboard, click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your `fleet-budget-dashboard` repo
4. Railway will auto-detect Node.js and start building

### Step 4: Add PostgreSQL
1. In your Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway automatically links the `DATABASE_URL` to your app

### Step 5: Set Environment Variables
In Railway → your service → **Variables** tab, add:
```
JWT_SECRET=<generate-a-random-64-char-string>
NODE_ENV=production
```

### Step 6: Seed the Database
1. In Railway, go to your service → **Settings** tab
2. Under **Deploy**, temporarily change the start command to: `npm run seed && npm start`
3. Deploy once, then change it back to just: `npm start`

Alternatively, use Railway's CLI:
```bash
railway run npm run seed
```

### Step 7: Access Your Dashboard
Railway will give you a public URL like `https://fleet-budget-dashboard-production.up.railway.app`

---

## Default Login Credentials

After seeding:

| Username | Password | Role | Access |
|----------|----------|------|--------|
| `admin` | `admin123` | Admin | Full fleet access |
| `alfred_temile` | `vessel123` | Vessel | Alfred Temile only |

**Important**: Change these passwords immediately after first login.

---

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL (local or Docker)

### Setup
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..

# Create .env from template
cp .env.example .env
# Edit .env with your local PostgreSQL connection string

# Initialize database and seed data
npm run seed

# Start development (two terminals)
npm run dev:server    # Terminal 1: API on port 3000
npm run dev:client    # Terminal 2: React on port 5173
```

### Quick Start with Docker (PostgreSQL only)
```bash
docker run --name fleet-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fleet_budget -p 5432:5432 -d postgres:16

# Then set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fleet_budget
```

---

## Project Structure

```
fleet-budget/
├── server/
│   ├── index.js              # Express server + static serving
│   ├── db.js                 # PostgreSQL connection + schema
│   ├── auth.js               # JWT middleware
│   ├── seed.js               # Database seeding script
│   └── routes/
│       ├── authRoutes.js     # Login + user CRUD
│       ├── vesselRoutes.js   # Vessel CRUD + fleet overview
│       ├── budgetRoutes.js   # Budget management
│       └── indentRoutes.js   # Indent tracking
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # Routing + auth + sidebar
│       ├── api.js            # API client
│       └── pages/
│           ├── Login.jsx
│           ├── AdminDashboard.jsx
│           ├── AdminVessels.jsx
│           ├── AdminBudgets.jsx
│           ├── AdminUsers.jsx
│           └── VesselDashboard.jsx
├── package.json
└── .env.example
```

---

## Adding a New Vessel

1. **Admin login** → Manage Vessels → Add Vessel (name, IMO, type)
2. **Set budgets** → Budgets → Select vessel → Add budget lines
3. **Create vessel user** → Users → Add User → Role: Vessel, assign to vessel
4. Share credentials with the vessel's Master/CE

---

## Future Enhancements

- [ ] FORCAP integration
- [ ] Purchase approval workflow
- [ ] PDF/Excel export
- [ ] Email notifications for threshold breaches
- [ ] Carried forward / year-end rollover
- [ ] Audit trail for budget changes
