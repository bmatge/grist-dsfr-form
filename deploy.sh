#!/usr/bin/env bash
set -euo pipefail

echo "=== Déploiement grist-dsfr-form ==="
echo "Domaine : gristformproxy.matge.com"
echo ""

cd "$(dirname "$0")"

echo "1/4 — Pull des dernières modifications..."
git pull

echo "2/4 — Build de l'image Docker..."
docker compose build --no-cache

echo "3/4 — Redémarrage du conteneur..."
docker compose down
docker compose up -d

echo "4/4 — Vérification..."
sleep 2
if docker compose ps | grep -q "running"; then
  echo ""
  echo "OK — Le service est en ligne."
  echo "URL : https://gristformproxy.matge.com"
  echo ""
  echo "Usage :"
  echo "  https://gristformproxy.matge.com/?url=https://grist.numerique.gouv.fr/forms/VOTRE_FORM_ID/1"
else
  echo ""
  echo "ERREUR — Le conteneur ne semble pas tourner."
  docker compose logs --tail 20
  exit 1
fi
