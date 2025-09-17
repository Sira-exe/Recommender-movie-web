import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(__dirname)); // serve index.html, css, js

const PORT = 3221;
app.listen(PORT, () => console.log(`✅ Frontend at http://localhost:${PORT}`));
