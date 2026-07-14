# Agente de sincronización SAP → Backend

Corre **dentro de la red de la empresa**, no en Render.

## Requisitos

- **Windows Server** con **Windows PowerShell 5.1** (incluido en el SO).
- **No requiere instalar Python ni ningún otro runtime.**
- Acceso de red a SAP Service Layer (`SAP_BASE_URL`) y salida HTTPS hacia el backend en Render.

> `sync.py` permanece en el repo como referencia (Linux / entornos con Python).

---

## Configuración

1. Copiá la carpeta `agente-sincronizacion/` al servidor (clon del repo o copia directa).
2. Creá el archivo `.env` junto a `sync.ps1`:

```powershell
cd C:\ruta\agente-sincronizacion
Copy-Item config.example.env .env
notepad .env
```

3. Completá las variables en `.env`:

| Variable | Descripción |
|---|---|
| `SAP_BASE_URL` | ej. `https://10.10.20.210:50000/b1s/v1` |
| `SAP_COMPANY_DB` | Company DB de SAP |
| `SAP_USER` / `SAP_PASSWORD` | Credenciales Service Layer (solo lectura) |
| `BACKEND_URL` | URL pública del backend en Render |
| `INGEST_API_KEY` | Mismo valor que en el backend |
| `SYNC_FROM_DATE` | Vacío = incremental automático; `2000-01-01` = carga histórica |
| `SYNC_OVERLAP_DAYS` | Default `7` — margen para datos retroactivos |
| `BATCH_SIZE` | Default `500` |
| `SAP_VERIFY_SSL` | `false` si el certificado SAP es autofirmado |

---

## Ejecución manual

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ruta\agente-sincronizacion\sync.ps1"
```

El script escribe logs en consola y en `sync.log` (misma carpeta).

**Primera corrida:** dejar `SYNC_FROM_DATE` vacío con base vacía dispara carga histórica desde `2000-01-01`.

---

## Programar en el Programador de Tareas (Windows)

1. Abrir **Programador de tareas** → **Crear tarea básica** (o tarea normal).
2. **Desencadenador:** diario, ej. 06:00.
3. **Acción:** Iniciar un programa
   - **Programa:** `powershell.exe`
   - **Argumentos:** `-NoProfile -ExecutionPolicy Bypass -File "C:\ruta\agente-sincronizacion\sync.ps1"`
   - **Iniciar en:** `C:\ruta\agente-sincronizacion`
4. Opcional: en **Configuración**, marcar "Ejecutar aunque el usuario no haya iniciado sesión" con una cuenta de servicio.

---

## Alternativa Python (referencia)

Ver [README principal](../README.md). Requiere Python 3 instalado:

```bash
python -m venv venv
pip install -r requirements.txt
cp .env.example .env
python sync.py
```
