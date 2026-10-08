@echo off
echo ==============================================
echo   Lancement de cALANdar en Localhost...
echo ==============================================

echo.
echo Demarrage des conteneurs Docker...
docker-compose up -d --build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERREUR] Impossible de lancer Docker Compose. Verifiez que Docker Desktop est bien demarre.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==============================================
echo   cALANdar est pret !
echo ==============================================
echo.
echo - Frontend : http://localhost:8080
echo - Backend  : http://localhost:8000
echo - MailHog  : http://localhost:8025
echo.
echo Ouverture de l'application dans votre navigateur...
start http://localhost:8080

echo.
echo Appuyez sur une touche pour fermer cette fenetre (les conteneurs continuent de tourner en arriere-plan).
pause >nul
