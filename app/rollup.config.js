import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import css from 'rollup-plugin-css-only';
import terser from '@rollup/plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default [
    // Dashboard Widget Bundle
    {
        input: 'dashboardwidget.js',
        output: {
            sourcemap: !production,
            format: 'iife',
            name: 'DashlyticsWidget',
            file: 'public/build/dashboardwidget.js',
            inlineDynamicImports: true
        },
        plugins: [
            svelte({
                compilerOptions: {
                    dev: !production,
                    // CSS wird inline im JS gehalten für Widget
                    css: 'injected'
                },
                emitCss: false
            }),
            resolve({
                browser: true,
                dedupe: ['svelte']
            }),
            commonjs(),
            production && terser()
        ],
        watch: {
            clearScreen: false
        }
    },
    // Settings Page Bundle
    {
        input: 'settings.js',
        output: {
            sourcemap: !production,
            format: 'iife',
            name: 'DashlyticsSettings',
            file: 'public/build/settings.js',
            inlineDynamicImports: true
        },
        plugins: [
            svelte({
                compilerOptions: {
                    dev: !production
                }
            }),
            css({ output: 'bundle.css' }),
            resolve({
                browser: true,
                dedupe: ['svelte']
            }),
            commonjs(),
            production && terser()
        ],
        watch: {
            clearScreen: false
        }
    }
];
