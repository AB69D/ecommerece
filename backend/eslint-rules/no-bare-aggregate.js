/**
 * ESLint rule: no-bare-aggregate
 *
 * Catches direct Model.aggregate() calls inside src/controllers/ and
 * src/routes/ and requires them to use tenantAggregate() from
 * tenancy/tenantAggregate.js instead.
 *
 * WHY: .aggregate() bypasses Mongoose query middleware (including the
 * tenantPlugin pre-aggregate hook). Even though tenantPlugin.js has a
 * pre('aggregate') hook that auto-prepends { $match: { tenantId } },
 * it runs AFTER the pipeline is built — a developer who adds a $facet
 * or $lookup as the FIRST stage, or forgets to call this inside a tenant
 * context, silently returns cross-tenant data.  tenantAggregate() makes
 * the contract explicit and fails at call time rather than silently.
 *
 * SETUP (one-time):
 *   npm install --save-dev eslint @eslint/js
 *   # then in eslint.config.js (see below)
 *
 * EXCEPTIONS: platform/cross-tenant code must use runAsSystem() which
 * lets the pre('aggregate') hook skip scoping. The rule therefore exempts
 * files under src/tenancy/ and src/scripts/.
 *
 * HOW TO USE IN eslint.config.js:
 *
 *   import noBarAgg from './eslint-rules/no-bare-aggregate.js';
 *
 *   export default [
 *     {
 *       files: ['src/controllers/**', 'src/routes/**'],
 *       plugins: { local: { rules: { 'no-bare-aggregate': noBarAgg } } },
 *       rules: { 'local/no-bare-aggregate': 'error' },
 *     },
 *   ];
 */

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Disallow bare Model.aggregate() — use tenantAggregate() to prevent cross-tenant data leaks.',
            recommended: true,
        },
        messages: {
            bareAggregate:
                'Direct .aggregate() call detected. Use tenantAggregate(Model, pipeline, tenantId) ' +
                "from 'tenancy/tenantAggregate.js' so the tenantId $match is always applied. " +
                'Exception: wrap in runAsSystem() for intentional cross-tenant platform queries.',
        },
        schema: [],
    },

    create(context) {
        // Files under tenancy/ or scripts/ are exempt: they either implement the
        // scoping primitives themselves, or are migration / seed scripts that run
        // in system context.
        const filename = context.getFilename();
        if (/[/\\](tenancy|scripts)[/\\]/.test(filename)) return {};

        return {
            // Catches: SomeModel.aggregate([...]) or Model.aggregate([...])
            // The callee is a MemberExpression with property name 'aggregate'.
            CallExpression(node) {
                if (
                    node.callee.type === 'MemberExpression' &&
                    node.callee.property.type === 'Identifier' &&
                    node.callee.property.name === 'aggregate'
                ) {
                    // Allow tenantAggregate itself (it calls Model.aggregate internally).
                    // Allow calls where the object is also named tenantAggregate (unlikely
                    // but defensive).
                    const obj = node.callee.object;
                    if (obj.type === 'Identifier' && obj.name === 'tenantAggregate') return;

                    context.report({ node, messageId: 'bareAggregate' });
                }
            },
        };
    },
};
