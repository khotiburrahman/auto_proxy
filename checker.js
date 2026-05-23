const net = require('net');
const fs = require('fs');

const NAUTICA_URL = "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt";
const TIMEOUT = 3000; // Batas waktu cek 3 detik per proxy

async function checkProxy(ip, port, country, org) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(TIMEOUT);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve({ ip, port, country, org, isAlive: true });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ isAlive: false });
    });
    
    socket.on('error', () => {
      resolve({ isAlive: false });
    });
    
    socket.connect(port, ip);
  });
}

async function run() {
  const req = await fetch(NAUTICA_URL);
  const text = await req.text();
  const lines = text.split('\n').filter(Boolean);

  const promises = lines.map(line => {
    const [ip, port, country, org] = line.split(',');
    if (ip && port) return checkProxy(ip, parseInt(port), country, org);
  }).filter(Boolean);

  const results = await Promise.all(promises);
  const activeProxies = results.filter(r => r.isAlive);

  const outputData = activeProxies.map(r => `${r.ip},${r.port},${r.country},${r.org}`).join('\n');
  fs.writeFileSync('active_proxies.txt', outputData);
  
  console.log(`Sukses: ${activeProxies.length} proxy aktif tersimpan.`);
}

run();
