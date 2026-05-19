import CategoryProducts from "./CategoryProducts";

export default async function CategoryPage({ params }) {
    const { category } = await params;
    const categorySlug = decodeURIComponent(category);
    return <CategoryProducts categorySlug={categorySlug} />;
}