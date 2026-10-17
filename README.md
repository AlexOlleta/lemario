# Lemario

Interfaz web sencilla para la API **Lemario** (palabras del diccionario de la RAE): rimas consonantes, búsquedas, palabra al azar, significados y comprobación de palabras. Pensada para personas sin conocimientos técnicos; solo expone la API, no calcula nada por su cuenta.

## Cómo funciona

```
Navegador ──► este servidor (FastAPI) ──► API Lemario (:8000)
                 guarda la X-API-Key
```

El navegador nunca ve la clave: este pequeño servidor sirve la web y reenvía solo las consultas permitidas (solo `GET`, lista blanca de rutas) añadiendo la clave.

## Con Docker (recomendado)

```bash
cp .env.example .env   # y rellena LEMARIO_API_KEY
docker compose up -d --build
```

Abre http://127.0.0.1:8080. La API debe estar arrancada en el ordenador; el contenedor la alcanza como `host.docker.internal:8000`.

## Sin Docker

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # Linux/macOS: .venv/bin/pip
LEMARIO_API_KEY=... .venv/Scripts/python -m uvicorn app.main:app --port 8080
```

## Configuración

| Variable | Por defecto | Para qué |
|---|---|---|
| `LEMARIO_API_KEY` | — | Clave de la API (obligatoria) |
| `LEMARIO_API_URL` | `http://127.0.0.1:8000` (`host.docker.internal` en Docker) | Dirección de la API |
| `LEMARIO_TIMEOUT` | `10` | Segundos de espera a la API |
| `PORT` | `8080` | Puerto en tu ordenador (solo Docker) |

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

## Seguridad

- La clave vive solo en el servidor (`.env` está en `.gitignore`).
- Solo se reenvían rutas de lectura conocidas; el resto devuelve 404.
- CSP estricta, sin scripts ni estilos en línea; el contenido de la API se pinta siempre como texto.
- El contenedor corre sin privilegios, con sistema de ficheros de solo lectura, y el puerto solo escucha en `127.0.0.1`.

## Tipografía

[Source Serif 4](https://github.com/adobe-fonts/source-serif) (licencia SIL OFL 1.1, ver `app/static/fonts/OFL.txt`), incluida en el proyecto: no se carga nada de servidores externos.
