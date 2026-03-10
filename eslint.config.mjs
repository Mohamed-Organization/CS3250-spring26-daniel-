import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    // 1. Tell ESLint which files to watch
    files: ["**/*.js"], 
    languageOptions: { 
      globals: {
        ...globals.browser,
        ...globals.webextensions // 🦊 Necessary for Firefox!
      } 
    },
    // 2. Add the rules you want to enforce
    rules: {
      "no-unused-vars": ["error", { "varsIgnorePattern": "^_", "argsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_"  }],
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": "error"
    }
  },
  pluginJs.configs.recommended,
];