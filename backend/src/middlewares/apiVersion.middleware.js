/**
 * API Versioning middleware.
 *
 * Adds `X-API-Version` to every response that passes through the versioned
 * (/api/v1/*) or the legacy (/api/*) prefixes.  Legacy responses also carry:
 *
 *   Deprecation: true
 *   Sunset:      <date one year out>
 *   Link:        </api/v1/...>; rel="successor-version"
 *
 * so callers can migrate at their own pace without being broken.
 */

const API_VERSION = '1';

/**
 * Stamp every response with the current API version number.
 * Mount this once on /api and /api/v1 BEFORE any route handler.
 */
export const addVersionHeader = (_req, res, next) => {
    res.setHeader('X-API-Version', API_VERSION);
    next();
};

/**
 * Mark this request as targeting the deprecated un-versioned /api/* prefix.
 * Adds RFC 8594 Deprecation + Sunset headers and a rel=successor-version Link
 * so well-behaved clients can auto-detect the migration path.
 *
 * The Sunset date is one year from the server start time (rounded to the day).
 * Adjust or make it a config value once a concrete EOL date is known.
 */
const _sunsetDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    // RFC 7231 HTTP-date — always UTC
    return d.toUTCString();
})();

export const markDeprecated = (req, res, next) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', _sunsetDate);
    // Rewrite /api/<rest> -> /api/v1/<rest> for the Link header
    const successor = req.originalUrl.replace(/^\/api\//, '/api/v1/');
    res.setHeader('Link', `<${successor}>; rel="successor-version"`);
    next();
};
