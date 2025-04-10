#!/bin/bash

# Renk tanımları
ORANGE='\033[1;33m'
GREEN='\033[1;32m'
RESET='\033[0m'

clear
echo -e "${ORANGE}Synapic Kurulumu Başlatılıyor...${RESET}"

# Klonlama işlemi (gizli)
git clone https://github.com/yigitkabak/Synapic > /dev/null 2>&1

if [ -d "Synapic" ]; then
    echo -e "${GREEN}Git klonu oluşturuldu ✅${RESET}"
    cd Synapic

    # Her paketi sırayla naper ile yükle (gizli çıktı)
    echo -e "${ORANGE}Bağımlılıklar yükleniyor...${RESET}"
    
    naper install ejs > /dev/null 2>&1 && echo -e "${GREEN}ejs kuruldu ✅${RESET}"
    naper install axios > /dev/null 2>&1 && echo -e "${GREEN}axios kuruldu ✅${RESET}"
    naper install express > /dev/null 2>&1 && echo -e "${GREEN}express kuruldu ✅${RESET}"
    naper install cheerio > /dev/null 2>&1 && echo -e "${GREEN}cheerio kuruldu ✅${RESET}"

    echo
    echo -e "${ORANGE}Synapic Search kurulumu Sona Erdi.${RESET}"
    echo -e "${ORANGE}Aperture Labs. ©2024"
    echo
    sleep 1
    node app.js
else
    echo -e "${RED}Klonlama başarısız oldu, kurulum iptal edildi.${RESET}"
fi
