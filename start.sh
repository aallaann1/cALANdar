#!/bin/bash
echo "=============================================="
echo "  Lancement de cALANdar en Localhost..."
echo "=============================================="

docker-compose up -d --build

if [ $? -ne 0 ]; then
    echo "[ERREUR] Impossible de lancer Docker Compose."
    exit 1
fi

echo ""
echo "=============================================="
echo "  cALANdar est prêt !"
echo "=============================================="
echo "- Frontend : http://localhost:8080"
echo "- Backend  : http://localhost:8000"
echo "- MailHog  : http://localhost:8025"
echo ""
