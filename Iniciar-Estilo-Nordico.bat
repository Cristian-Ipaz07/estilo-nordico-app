@echo off
echo Iniciando Estilo Nordico (App de Escritorio)...
echo Este script usara WSL para levantar tu backend y frontend en segundo plano.
wsl -d Ubuntu -e bash -c "cd /home/cristian_ipaz/proyectos/estilo-nordico-app/desktop-app && npm start"
