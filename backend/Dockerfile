FROM python:3.11-slim

# Métadonnées
LABEL maintainer="ENSIT GreenTech Team"
LABEL description="Smart Green ENSIT — Backend FastAPI"

# Répertoire de travail
WORKDIR /app

# Dépendances système (pour psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Installation des dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code source
COPY . .

# Port exposé
EXPOSE 8000

# Démarrage avec hot-reload (développement)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
