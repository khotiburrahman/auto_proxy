const net = require('net');
const fs = require('fs');

const NAUTICA_URL = "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt";
const TIMEOUT = 3000;

async function checkProxy(ip, port, country, org) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(TIMEOUT);
    const startTime = Date.now();
    
    socket.on('connect', () => {
      const latency = Date.now() - startTime;
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
  try {
    const req = await fetch(NAUTICA_URL);
    const text = await req.text();
    const lines = text.split('\n').filter(Boolean);

    const promises = lines.map(line => {
      const [ip, port, country, org] = line.split(',');
      if (ip && port) return checkProxy(ip, parseInt(port), country, org);
    }).filter(Boolean);

    const results = await Promise.all(promises);
    const activeProxies = results.filter(r => r.isAlive);

    const groupedProxies = {};
    for (const prx of activeProxies) {
      if (!groupedProxies[prx.country]) groupedProxies[prx.country] = [];
      groupedProxies[prx.country].push(prx);
    }
    
    const finalProxies = [];
    const mainCountries = ["SG", "ID", "MY"]; 

    for (const country in groupedProxies) {
      // Urutkan dari ping terendah (tercepat)
      groupedProxies[country].sort((a, b) => a.latency - b.latency);
      
      // Ambil 10 untuk SG/ID/MY, 5 untuk sisanya
      const limit = mainCountries.includes(country) ? 10 : 5; 
      finalProxies.push(...groupedProxies[country].slice(0, limit));
    }

    const outputData = finalProxies.map(r => `${r.ip},${r.port},${r.country},${r.org}`).join('\n');
    fs.writeFileSync('active_proxies.txt', outputData);
    
    console.log(`Sukses: ${finalProxies.length} proxy aktif tersimpan.`);
  } catch (error) {
    console.error("Terjadi kesalahan saat mengeksekusi script:", error);
  }
}

run();
