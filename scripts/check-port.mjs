// Fails fast if the dev port is taken. Next moves to another port silently, and the platform host
// (NEXT_PUBLIC_ROOT_DOMAIN) would then stop matching, so every page 404s.
import net from "node:net";

const port = Number(process.argv[2] ?? 3000);
const server = net.createServer().once("error", () => {
  console.error(`\nPort ${port} is already in use. Stop the other server (lsof -nP -iTCP:${port} -sTCP:LISTEN) and try again.\n`);
  process.exit(1);
});
server.listen(port, "0.0.0.0", () => server.close(() => process.exit(0)));
