#!/bin/bash
# Dwuklik uruchamia aplikację Setter AI – FollowUP
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
echo "==============================================="
echo "  Setter AI – FollowUP"
echo "==============================================="
if [ ! -d node_modules ]; then
  echo "Pierwsze uruchomienie — instaluję zależności..."
  npm install || { echo "Błąd instalacji. Czy Node.js jest zainstalowany?"; read -r; exit 1; }
fi
echo "Startuję serwer... (zostaw to okno otwarte)"
( sleep 2 && open "http://localhost:3000" ) &
npm start
