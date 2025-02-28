import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { name } from './package.json';

const libName = name
    .replace('@univerjs/', 'univer-')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

export default defineConfig(({ mode }) => ({
    plugins: [
        react(),
        dts({
            entryRoot: 'src',
            outDir: 'lib/types',
        }),
    ],
    resolve: {
        alias: [
            {
                find: /^monaco-editor$/,
                replacement: __dirname + '/node_modules/monaco-editor/esm/vs/editor/editor.api',
            },
        ],
    },
    css: {
        modules: {
            localsConvention: 'camelCaseOnly',
            generateScopedName: 'univer-[local]',
        },
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
        outDir: 'lib',
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: libName,
            fileName: (format) => `${format}/index.js`,
            formats: ['es', 'umd', 'cjs'],
        },
        rollupOptions: {
            external: [
                '@univerjs/core',
                '@univerjs/design',
                '@univerjs/sheets',
                '@univerjs/sheets-ui',
                '@univerjs/ui',
                '@wendellhu/redi',
                '@wendellhu/redi/react-bindings',
                'monaco-editor',
                'react',
                'rxjs',
            ],
            output: {
                assetFileNames: 'index.css',
                globals: {
                    '@univerjs/core': 'UniverCore',
                    '@univerjs/design': 'UniverDesign',
                    '@univerjs/sheets': 'UniverSheets',
                    '@univerjs/sheets-ui': 'UniverSheetsUi',
                    '@univerjs/ui': 'UniverUi',
                    '@wendellhu/redi': '@wendellhu/redi',
                    '@wendellhu/redi/react-bindings': '@wendellhu/redi/react-bindings',
                    'monaco-editor': 'monaco',
                    react: 'React',
                    rxjs: 'rxjs',
                },
            },
        },
    },
    test: {
        environment: 'happy-dom',
        coverage: {
            provider: 'istanbul',
        },
    },
}));
