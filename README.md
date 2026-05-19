# ecommerece

Full-stack e-commerce monorepo.

## Structure

- [`frontend/`](frontend/) — Next.js storefront (Node.js / React).
- [`backend/`](backend/) — Node.js / Express API server with MongoDB.

## Getting started

### Backend

```bash
cd backend
cp .env.example .env   # fill in real values
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend URL via its own environment configuration. See each subdirectory for details.

## Notes

- `.env` files are git-ignored. Never commit secrets.
- `node_modules/`, `.next/`, `.vercel/`, and build artifacts are git-ignored.
