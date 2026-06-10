// Renders an admin-authored page body (HTML) inside a styled, consistent
// "prose" container that matches the look of the built-in content pages.
// The HTML comes from the admin Pages editor (trusted, admin-only input).
export default function CmsArticle({ title, html }) {
    return (
        <div className="py-8 px-4 max-w-4xl mx-auto">
            {title ? (
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-8">{title}</h1>
            ) : null}
            <div
                className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-8 text-gray-600 leading-relaxed break-words
                    [&_h2]:text-lg [&_h2]:sm:text-xl [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:first:mt-0
                    [&_h3]:text-base [&_h3]:sm:text-lg [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-4 [&_h3]:mb-2
                    [&_p]:mb-4
                    [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1
                    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1
                    [&_li]:leading-relaxed
                    [&_a]:text-emerald-600 [&_a]:underline [&_a]:break-words hover:[&_a]:text-emerald-700
                    [&_strong]:text-gray-800 [&_strong]:font-semibold
                    [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-200 [&_blockquote]:pl-4 [&_blockquote]:italic
                    [&_img]:rounded-xl [&_img]:my-4 [&_img]:max-w-full [&_img]:h-auto
                    [&_pre]:overflow-x-auto [&_pre]:rounded-lg
                    [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:my-4
                    [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2
                    [&_th]:border [&_th]:border-gray-200 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-gray-50 [&_th]:text-left"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}
