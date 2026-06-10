// Renders a single JSON-LD structured-data block. Safe to drop anywhere in the
// tree (works in Server Components). Pass a plain object as `data`.
export default function JsonLd({ data }) {
    if (!data) return null;
    return (
        <script
            type="application/ld+json"
            // JSON.stringify output is safe to inline; no user HTML is interpolated.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
