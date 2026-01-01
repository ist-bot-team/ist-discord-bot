import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("src", "prisma", "schema.prisma"),
  datasource: {
    url: env('DATABASE_URL'),
  },
});
