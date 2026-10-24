import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Las pruebas de horarios dependen de la zona horaria local: fijamos la del usuario
// para que los resultados no cambien según la máquina (CI corre en UTC).
process.env.TZ = "America/Mexico_City";

export default defineConfig({
  resolve: {
    // Equivalente a "paths": { "@/*": ["./*"] } de tsconfig.json.
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { TZ: "America/Mexico_City" },
  },
});
