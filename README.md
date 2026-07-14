# Portal Web de Productores — CLALDY SA

Portal de autoservicio para productores lecheros. MVP: calidad/composición de leche sincronizada desde SAP Business One.

## Estructura

```
web-productores/
├── backend/                 → API Node.js (Render Web Service)
├── agente-sincronizacion/   → Script Python (servidor OpenVPN, NO Render)
├── frontend/                → SPA React + Vite
└── README.md
```

## Arquitectura

```
[Productor] → [Frontend] → [Backend Render] ← [PostgreSQL]
                                ↑
                    [Agente sync] (red interna → SAP)
```

El backend **nunca** contacta SAP directamente. El agente corre dentro de la red de la empresa y empuja datos por HTTPS.

---

## Backend

**Stack:** Node.js 18+, Express, PostgreSQL.

### Variables de entorno (Render)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Autogenerada al vincular PostgreSQL en Render |
| `DATABASE_SSL` | `true` en Render |
| `JWT_SECRET` | String aleatorio largo |
| `INGEST_API_KEY` | Compartida con el agente |
| `FRONTEND_URL` | URL del frontend (CORS) |
| `PORT` | Render lo setea automáticamente |

### Endpoints

**Públicos**
- `POST /auth/activate` — activación con código WhatsApp
- `POST /auth/login` — JWT
- `POST /auth/forgot-password` / `POST /auth/reset-password`
- `GET /api/calidad-composicion?from=&to=` — requiere JWT
- `GET /api/calidad-composicion/resumen` — último + promedio 30 días

**Internos** (header `X-Api-Key`)
- `POST /internal/ingest/calidad-composicion`
- `GET /internal/sync-status`
- `GET /internal/pending-activations` — listado para envío WhatsApp

### Desarrollo local

```bash
cd backend
cp .env.example .env   # completar valores
npm install
npm run migrate        # opcional; el server también aplica el schema al arrancar
npm run dev
```

### Deploy en Render

- **Root Directory:** `backend`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- Conectar la base PostgreSQL existente y setear `DATABASE_SSL=true`.

---

## Agente de sincronización

Corre en el servidor OpenVPN de la empresa (cron diario). **No se despliega en Render.**

```bash
cd agente-sincronizacion
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # completar credenciales SAP y backend
python sync.py
```

**Primera corrida:** dejar `SYNC_FROM_DATE` vacío o `2000-01-01` para carga histórica (~22.871 registros).

**Corridas siguientes:** el agente consulta `GET /internal/sync-status` y sincroniza incrementalmente.

**Cron ejemplo (Linux):**
```
0 6 * * * cd /ruta/agente-sincronizacion && ./venv/bin/python sync.py >> sync.log 2>&1
```

**Listado de activaciones pendientes:**
```bash
curl -H "X-Api-Key: TU_KEY" https://tu-backend.onrender.com/internal/pending-activations
```

---

## Frontend

**Stack:** React 18, Vite, React Router.

### Variables

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL pública del backend |

### Desarrollo local

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Deploy

Static Site en Render, Vercel o Netlify. Build: `npm run build`, publish: `dist/`.

---

## Flujo de activación de productores

1. La sincronización crea productores nuevos con `estado = pendiente_activacion` y genera un `activation_code` (45 días de validez).
2. El equipo consulta `/internal/pending-activations` y envía el código por WhatsApp.
3. El productor activa en `/activate` con su `card_code`, código, email y contraseña.

---

## Próximos dominios (fuera de MVP)

- Entregas de leche
- Liquidaciones y precios

Se agregarán como tablas y endpoints independientes, sin modificar lo existente.
