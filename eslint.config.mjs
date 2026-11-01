import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  // Compiler adoption checks are advisory; this app does not enable React Compiler.
  { rules: {
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/immutability': 'warn',
    'react-hooks/purity': 'warn',
    // Private media uses authenticated, pre-generated previews.
    '@next/next/no-img-element': 'off',
  } },
  globalIgnores(['.next/**', 'node_modules/**', '.codegraph/**']),
])
