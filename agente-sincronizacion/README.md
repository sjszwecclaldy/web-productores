# Agente de sincronización SAP → Backend

Corre **dentro de la red de la empresa**, no en Render.

Ver [README principal](../README.md) para configuración, cron y primera carga histórica.

```bash
python -m venv venv
pip install -r requirements.txt
cp .env.example .env
python sync.py
```
