"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const dataFetchers_1 = require("./dataFetchers");
const routes_1 = require("./routes");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express_1.default.static('public'));
(0, routes_1.setupRoutes)(app, IPINFO_TOKEN);
const server = app.listen(PORT, () => {
    console.log(`Synapic Search sunucusu çalışıyor: http://localhost:${PORT}`);
    const cacheStorage = dataFetchers_1.Cache.getStorage();
    const cacheExpiration = 15 * 60 * 1000;
    setInterval(() => {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [key, item] of cacheStorage.entries()) {
            if (item.expiry < now) {
                cacheStorage.delete(key);
                cleanedCount++;
            }
        }
    }, cacheExpiration);
});
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
