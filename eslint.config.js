import globals from "globals";
// JavaScript do servidor, scripts, testes e regras compartilhadas. O frontend (web/, TypeScript)
// é conferido por "npm run typecheck".
const rules = {
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "no-undef": "error",
  "no-constant-condition": "error",
};
export default [
  { ignores: ["node_modules/**", "dist/**", "dist-ssr/**", "tmp/**"] },
  {
    files: ["**/*.js"],
    ignores: ["shared/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules,
  },
  // shared/: regras usadas pelo servidor, pelo navegador e pelos testes; sem DOM nem APIs do Node.
  {
    files: ["shared/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals["shared-node-browser"] },
    },
    rules,
  },
];
