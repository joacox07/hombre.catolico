/** Levanta el panel visor localmente. Uso: npm run panel  →  abrir http://localhost:5173/panel/ */
import { startServer } from "./server.ts";

const port = Number(process.env.PORT || 5173);
const { url } = await startServer(port);
console.log(`\n  Panel visor en:  ${url}/panel/\n  (Ctrl+C para cortar)\n`);
