import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import css from 'rollup-plugin-css-only';
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

function serve() {
    let server;

    function toExit() {
        if (server) server.kill(0);
    }

    return {
        writeBundle() {
            if (server) return;
            server = require('child_process').spawn('npm', ['run', '--'], {
                stdio: ['ignore', 'inherit', 'inherit'],
                shell: true
            });

            process.on('SIGTERM', toExit);
            process.on('exit', toExit);
        }
    };
}

export default {
    input: 'dashboardwidget.js',
    output: {
        sourcemap: true,
        format: 'iife',
        name: 'dashboardwidget',
        file: 'public/build/dashboardwidget.js'
    },
    input: 'settings.js',
    output: {
        sourcemap: true,
        format: 'iife',
        name: 'settings',
        file: 'public/build/settings.js'
    },
    plugins: [
        svelte({
            compilerOptions: {
                dev: !production
            }
        }),
        css({ output: 'bundle.css'}),
        resolve({
            browser: true,
            dedupe: ['svelte']
        }),
        commonjs(),
        !production && serve(),
        !production && livereload('public'),
        production && terser()
    ],
    watch: {
        clearScreen: false
    }
};