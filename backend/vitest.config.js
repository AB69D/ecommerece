import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Exclude macOS resource-fork shadow files (._*) that Rollup/Vite
        // cannot parse (binary files starting with \0).
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.{idea,git,cache,output,temp}/**',
            '**/._*',           // macOS resource forks
        ],
        environment: 'node',
    },
});
