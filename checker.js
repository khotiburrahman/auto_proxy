const net = require('net');
const fs = require('fs');

const NAUTICA_URL = "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt";
const TIMEOUT = 3000;

async function checkProxy(ip, port, country, org) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(TIMEOUT);
    const startTime = Date.now(); // Mulai hitung waktu (ping)
    
    socket.on('connect', () => {
      const latency = Date.now() - startTime; // Hitung selisih waktu
      socket.destroy();
      resolve({ ip, port, country, org, isAlive: true, latency });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ isAlive: false, latency: Infinity });
    });
    
    socket.on('error', () => {
      resolve({ isAlive: false, latency: Infinity });
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

  // Mengelompokkan berdasarkan negara
  const groupedProxies = {};
  for (const prx of activeProxies) {
    if (!groupedProxies[prx.country]) {
      groupedProxies[prx.country] = [];
    }
    groupedProxies[prx.country].push(prx);
  }
  
  // Mengurutkan dari ping terendah dan mengambil 10 terbaik
  const finalProxies = [];
  for (const country in groupedProxies) {
    groupedProxies[country].sort((a, b) => a.latency - b.latency);
    finalProxies.push(...groupedProxies[country].slice(0, 10));
  }

  const outputData = finalProxies.map(r => `${r.ip},${r.port},${r.country},${r.org}`).join('\n');
  fs.writeFileSync('active_proxies.txt', outputData);
  
  console.log(`Sukses: ${finalProxies.length} proxy aktif dan tercepat tersimpan.`);
}

run();
