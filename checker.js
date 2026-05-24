const fs = require('fs');
const https = require('https');

const NAUTICA_URL = "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt";
const TIMEOUT = 4000; // 4 detik batas toleransi respons proxy
const TEST_TARGET = "https://www.cloudflare.com/cdn-cgi/trace";

async function checkProxy(ip, port, country, org) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let isResolved = false;

    // Menggunakan agent HTTPS bawaan Node.js yang dikonfigurasi melewati rute proxy
    const agent = new https.Agent({
      host: ip,
      port: port,
      keepAlive: false,
      timeout: TIMEOUT
    });

    const req = https.get(TEST_TARGET, { agent, timeout: TIMEOUT }, (res) => {
      if (res.statusCode !== 200) {
        cleanup();
        return resolve({ isAlive: false });
      }

      // 1. KECEPATAN BALASAN (TTFB): Waktu respons balik saat header pertama diterima
      const ttfb = Date.now() - startTime;
      
      let dataLength = 0;
      const startDownload = Date.now();

      // 2. KESTABILAN TRANSFER DATA: Mengalirkan data teks riil
      res.on('data', (chunk) => {
        dataLength += chunk.length;
      });

      res.on('end', () => {
        cleanup();
        if (isResolved) return;
        isResolved = true;

        const downloadTime = Date.now() - startDownload;
        // Hitung skor kestabilan (semakin banyak data per milidetik, semakin bagus)
        const speedScore = dataLength / (downloadTime || 1);

        resolve({
          ip, port, country, org,
          isAlive: true,
          ttfb,
          speedScore
        });
      });
    });

    function cleanup() {
      req.destroy();
    }

    req.on('error', () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve({ isAlive: false });
      }
    });

    req.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve({ isAlive: false });
      }
    });
  });
}

async function run() {
  try {
    console.log("Mengambil daftar proxy dari Nautica...");
    const req = await fetch(NAUTICA_URL);
    const text = await req.text();
    const lines = text.split('\n').filter(Boolean);

    console.log(`Memulai pengetesan ${lines.length} proxy secara simultan...`);

    const promises = lines.map(line => {
      const [ip, port, country, org] = line.split(',');
      if (ip && port) return checkProxy(ip, parseInt(port), country, org);
    }).filter(Boolean);

    const results = await Promise.all(promises);
    const activeProxies = results.filter(r => r.isAlive);

    // Pengelompokan berdasarkan negara
    const groupedProxies = {};
    for (const prx of activeProxies) {
      if (!groupedProxies[prx.country]) groupedProxies[prx.country] = [];
      groupedProxies[prx.country].push(prx);
    }

    const finalProxies = [];
    const mainCountries = ["SG", "ID", "MY"];

    for (const country in groupedProxies) {
      // LOGIKA SORTIR UTAMA:
      // 1. Urutkan berdasarkan speedScore tertinggi (paling stabil menarik data)
      // 2. Jika sama, urutkan berdasarkan ttfb terendah (paling cepat membalas)
      groupedProxies[country].sort((a, b) => b.speedScore - a.speedScore || a.ttfb - b.ttfb);

      // Ambil top 10 untuk SG/ID/MY, top 5 untuk negara lainnya
      const limit = mainCountries.includes(country) ? 10 : 5;
      finalProxies.push(...groupedProxies[country].slice(0, limit));
    }

    // Format output tetap sama persis seperti semula
    const outputData = finalProxies.map(r => `${r.ip},${r.port},${r.country},${r.org}`).join('\n');
    fs.writeFileSync('active_proxies.txt', outputData);

    console.log(`Sukses! ${finalProxies.length} proxy kualitas terbaik telah disimpan di active_proxies.txt`);
  } catch (error) {
    console.error("Terjadi kesalahan sistem:", error);
  }
}

run();
