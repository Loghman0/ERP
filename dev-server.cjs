const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
    if (req.url === '/') {
        req.url = '/index.html';
    }

    // Remove query string if any
    let reqPath = req.url.split('?')[0];
    let filePath = path.join(__dirname, reqPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        let extname = String(path.extname(filePath)).toLowerCase();
        let contentType = mimeTypes[extname] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fs.readFileSync(filePath), 'utf-8');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
}).listen(8000, '127.0.0.1', () => {
    console.log('Server running at http://127.0.0.1:8000/');
});
