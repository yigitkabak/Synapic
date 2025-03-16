#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');

// Ana fonksiyon
function runSynapic() {
  console.log('Synapic uygulaması başlatılıyor...');
  
  // Komut oluşturma
  const command = 'cd synapic && node app.js';
  
  console.log(`Çalıştırılacak komut: ${command}`);
  
  // Komutu çalıştırma
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Hata oluştu: ${error.message}`);
      return;
    }
    
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return;
    }
    
    console.log(`Stdout: ${stdout}`);
    console.log('Synapic uygulaması başarıyla çalıştırıldı.');
  });
}

// Programı çalıştır
runSynapic();
