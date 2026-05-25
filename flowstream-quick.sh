#!/bin/bash
set -e

REPO="tuusuario/flowstream"
VERSION="v0.1.0"
URL="https://github.com/$REPO/releases/download/$VERSION/flowstream.tar.gz"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}║     FlowStream - Quick Install    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════╝${NC}"
echo ""

# 1. Dependencias
echo -e "${CYAN}[1/4] Verificando dependencias...${NC}"
MISSING=""
for dep in mpv pkg-config; do
    command -v "$dep" &>/dev/null || MISSING="$MISSING $dep"
done
pkg-config --exists webkit2gtk-4.1 2>/dev/null || MISSING="$MISSING webkit2gtk-4.1"

if [ -n "$MISSING" ]; then
    echo -e "${RED}Faltan:$MISSING${NC}"
    echo "  Arch:   sudo pacman -S mpv webkit2gtk-4.1"
    echo "  Debian: sudo apt install mpv libwebkit2gtk-4.1-dev"
    echo "  Fedora: sudo dnf install mpv webkit2gtk4.1"
    exit 1
fi
echo -e "  ${GREEN}✓ OK${NC}"

# 2. Elegir modo
echo ""
echo -e "${CYAN}[2/4] Modo de instalación:${NC}"
echo "  1) Sistema (/usr/local/bin) — sudo"
echo "  2) Usuario (~/.local/bin)"
echo "  3) Solo descargar"
read -p "Opción [1-3] (default: 2): " MODO
MODO=${MODO:-2}

# 3. Descargar
echo ""
echo -e "${CYAN}[3/4] Descargando FlowStream $VERSION...${NC}"
TMP=$(mktemp -d)
curl -fsSL "$URL" -o "$TMP/flowstream.tar.gz"
echo -e "  ${GREEN}✓${NC} Descargado ($(du -h "$TMP/flowstream.tar.gz" | cut -f1))"

tar xzf "$TMP/flowstream.tar.gz" -C "$TMP"
echo -e "  ${GREEN}✓${NC} Extraído"

# 4. Instalar
echo ""
echo -e "${CYAN}[4/4] Instalando...${NC}"

case "$MODO" in
    1)
        BIN="/usr/local/bin/streaming-app"
        DATA="/usr/local/share/flowstream"
        DESKTOP="/usr/local/share/applications"
        SUDO="sudo"
        ;;
    2)
        BIN="$HOME/.local/bin/streaming-app"
        DATA="$HOME/.local/share/flowstream"
        DESKTOP="$HOME/.local/share/applications"
        SUDO=""
        mkdir -p "$HOME/.local/bin"
        ;;
    3)
        mkdir -p flowstream
        cp "$TMP/flowstream-pkg/streaming-app" flowstream/
        echo -e "  ${GREEN}✓${NC} Binario en ./flowstream/streaming-app"
        echo "Ejecuta: ./flowstream/streaming-app"
        rm -rf "$TMP"
        exit 0
        ;;
esac

$SUDO mkdir -p "$BIN" "$DATA/extensions" "$DESKTOP" 2>/dev/null || true
$SUDO cp "$TMP/flowstream-pkg/streaming-app" "$BIN"
$SUDO cp -r "$TMP/flowstream-pkg/extensions/"* "$DATA/extensions/" 2>/dev/null || true

cat > /tmp/flowstream.desktop << EOF
[Desktop Entry]
Name=FlowStream
Comment=App de streaming con extensiones para Linux
Exec=$BIN
Icon=$DATA/icon.png
Terminal=false
Type=Application
Categories=AudioVideo;Player;
StartupWMClass=FlowStream
EOF
$SUDO cp /tmp/flowstream.desktop "$DESKTOP/"

echo -e "  ${GREEN}✓${NC} Instalado en $BIN"

# PATH para modo usuario
if [ "$MODO" = "2" ]; then
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        [ -f "$rc" ] && grep -q "\.local/bin" "$rc" 2>/dev/null || \
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$rc"
    done
fi

rm -rf "$TMP"

echo ""
echo -e "${GREEN}╔══════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ¡FlowStream instalado!          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════╝${NC}"
echo ""
echo -e "  Ejecuta: ${CYAN}streaming-app${NC}"
echo ""
