import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
      },
    },
  },
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
      "analyze.js",
      "todo_ops.py",
      "list_tables.py",
      "show_tasks_db_tables.py",
      "tasks/**",
      "n8n-mcp-server/dist/**",
    ],
  },
  {
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "preserve-caught-error": "off",
    },
  },
  // CLI entry points, demo scripts, and utility scripts need console output
  // Also disable no-explicit-any for CLI files (dynamic agent API responses)
  {
    files: [
      "src/cli.ts",
      "src/cli-edge.ts",
      "src/cli-jules-interactive.ts",
      "src/interactive.ts",
      "src/index.ts",
      "src/cli/**/*.ts",
      "src/demo_*.ts",
      "scripts/**/*.ts",
      "scripts/**/*.js",
      // Server files that use console for startup/debug output
      "src/server/SystemController.ts",
      "src/server/routes/agents.ts",
      "src/server/routes/tracks.ts",
      // Tools and agents with console output
      "src/agents/developerPipeline.ts",
      "src/tools/browserBridge.ts",
      "src/tools/system.ts",
      // Config and utilities
      "src/config/**/*.ts",
      "src/config/**/*.js",
      "src/utils/db.ts",
      "src/dashboard/tailwind.config.js",
    ],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Types definitions often need any for generic flexibility
  {
    files: ["src/types/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Test files - allow console and any types (test helpers are inherently dynamic)
  {
    files: ["test/**/*.ts", "test/**/*.js"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
        test: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  // Agent files - heavily use dynamic AI APIs requiring any types
  // Many agents implement interface with optional parameters they don't use
  {
    files: ["src/agents/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },
  // Dashboard React components - UI event handlers and dynamic data
  {
    files: ["src/dashboard/**/*.ts", "src/dashboard/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },
  // Server routes and tools - dynamic request/response handling
  {
    files: ["src/server/**/*.ts", "src/tools/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Core utilities that use dynamic AI/DB APIs
  {
    files: ["src/core/**/*.ts", "src/utils/**/*.ts", "src/services/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },
  // Other src files with broad any usage
  {
    files: [
      "src/pipeline/**/*.ts",
      "src/orchestrator/**/*.ts",
      "src/security/**/*.ts",
      "src/matching/**/*.ts",
      "src/mesh/**/*.ts",
      "src/kernel/**/*.ts",
      "src/config/**/*.ts",
      "src/connectors/**/*.ts",
      "src/clients/**/*.ts",
      "src/data/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
