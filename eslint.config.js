import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "build/**",
      "node_modules/**",
      "external_research/**",
      "myai/**",
      "_KNOWLEDGE_BASE/**",
      "_archive/**",
      "mcp-brunella-core-UIX/**",
      "agentenv/**",
      "public/**",
      "coverage/**",
      "src/dashboard/.vite/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  {
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
