#!/bin/bash

# Dashlytics Plugin Build Script
# Erstellt eine installierbare ZIP-Datei für WordPress

set -e

echo "🚀 Dashlytics Plugin Build Script"
echo "=================================="

# Variablen
PLUGIN_NAME="dashlytics"
VERSION="0.7.8"
BUILD_DIR="./build"
DIST_DIR="./dist"

# Farben für Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Schritt 1: Cleanup
echo -e "${YELLOW}📦 Bereinige alte Builds...${NC}"
rm -rf "$BUILD_DIR"
rm -rf "$DIST_DIR"
mkdir -p "$BUILD_DIR/$PLUGIN_NAME"
mkdir -p "$DIST_DIR"

# Schritt 2: Node Modules installieren und Build
echo -e "${YELLOW}📦 Installiere Abhängigkeiten...${NC}"
cd app
npm install --legacy-peer-deps
echo -e "${YELLOW}🔨 Baue Svelte Komponenten...${NC}"
npm run build
cd ..

# Schritt 3: Dateien kopieren
echo -e "${YELLOW}📁 Kopiere Plugin-Dateien...${NC}"

# Hauptdateien
cp dashlytics-matomo.php "$BUILD_DIR/$PLUGIN_NAME/"
cp uninstall.php "$BUILD_DIR/$PLUGIN_NAME/"
cp readme.txt "$BUILD_DIR/$PLUGIN_NAME/"
cp README.md "$BUILD_DIR/$PLUGIN_NAME/"
cp LICENSE "$BUILD_DIR/$PLUGIN_NAME/"

# Assets
mkdir -p "$BUILD_DIR/$PLUGIN_NAME/assets/css"
cp -r assets/css/* "$BUILD_DIR/$PLUGIN_NAME/assets/css/"
cp assets/*.gif "$BUILD_DIR/$PLUGIN_NAME/assets/" 2>/dev/null || true
cp assets/*.png "$BUILD_DIR/$PLUGIN_NAME/assets/" 2>/dev/null || true

# App Build (nur die kompilierten Dateien)
mkdir -p "$BUILD_DIR/$PLUGIN_NAME/app/public/build"
cp app/public/build/*.js "$BUILD_DIR/$PLUGIN_NAME/app/public/build/"
cp app/public/build/*.css "$BUILD_DIR/$PLUGIN_NAME/app/public/build/"

# Languages Ordner (für zukünftige Übersetzungen)
mkdir -p "$BUILD_DIR/$PLUGIN_NAME/languages"

# Schritt 4: ZIP erstellen
echo -e "${YELLOW}📦 Erstelle ZIP-Archiv...${NC}"
cd "$BUILD_DIR"
zip -r "../$DIST_DIR/${PLUGIN_NAME}-${VERSION}.zip" "$PLUGIN_NAME" -x "*.DS_Store" -x "*__MACOSX*"
cd ..

# Schritt 5: Cleanup Build Dir
rm -rf "$BUILD_DIR"

# Fertig
echo ""
echo -e "${GREEN}✅ Build erfolgreich!${NC}"
echo -e "${GREEN}📦 Plugin ZIP: $DIST_DIR/${PLUGIN_NAME}-${VERSION}.zip${NC}"
echo ""
echo "Installation:"
echo "1. Gehe zu WordPress Admin → Plugins → Installieren → Plugin hochladen"
echo "2. Wähle die ZIP-Datei: ${PLUGIN_NAME}-${VERSION}.zip"
echo "3. Klicke auf 'Jetzt installieren' und dann 'Aktivieren'"

