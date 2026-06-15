// eslint.config.js (ESLint flat config — requires ESLint >=8.21 / v9)
//
// Install once:
//   npm install --save-dev eslint @eslint/js
//
// Run:
//   npx eslint src/controllers src/routes
//   npx eslint src/controllers src/routes --fix   (for auto-fixable rules only)

import noBarAgg from './eslint-rules/no-bare-aggregate.js';

export default [
    {
        // Only controllers and routes: platform/ and tenancy/ are intentionally
        // exempt (they implement the primitives or run in system context).
        files: ['src/controllers/**/*.js', 'src/routes/**/*.js'],
        plugins: {
            local: {
                rules: {
                    'no-bare-aggregate': noBarAgg,
                },
            },
        },
        rules: {
            // Error: treat bare .aggregate() as a build-breaking violation.
            'local/no-bare-aggregate': 'error',
        },
    },
];
