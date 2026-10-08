@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Creer le serveur Discord MonTrioHockey
echo.
echo === Installation de ce qu'il faut (une seule fois) ===
where py >nul 2>nul
if errorlevel 1 (
  echo.
  echo Python n'est pas installe. Va sur https://www.python.org/downloads/
  echo et coche "Add python.exe to PATH" pendant l'installation.
  echo.
  pause
  exit /b
)
if not exist "creer_serveur_discord.py" (
  echo.
  echo Le fichier creer_serveur_discord.py doit etre dans le meme dossier que ce fichier.
  echo.
  pause
  exit /b
)
py -m pip install --quiet --disable-pip-version-check discord.py
echo.
echo === Creation du serveur ===
echo.
py creer_serveur_discord.py
echo.
pause
