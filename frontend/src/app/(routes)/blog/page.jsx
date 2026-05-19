export default function BlogPage() {
    const blogs = [
        {
            title: "The Benefits of Organic Honey",
            date: "April 20, 2026",
            excerpt: "Discover why organic honey is considered liquid gold and how it can transform your health.",
            category: "Health"
        },
        {
            title: "Traditional Ghee vs. Modern Ghee",
            date: "April 18, 2026",
            excerpt: "Learn about the differences between traditional cow ghee and processed alternatives.",
            category: "Food Guide"
        },
        {
            title: "How to Identify Authentic Aachar",
            date: "April 15, 2026",
            excerpt: "Tips and tricks to identify the best quality homemade pickles for your family.",
            category: "Tips"
        },
        {
            title: "The Story Behind Gram2ghor",
            date: "April 10, 2026",
            excerpt: "How we started our journey to bring authentic Bangladeshi food to every home.",
            category: "Company"
        },
        {
            title: "Health Benefits of Desi Gura Mosla",
            date: "April 5, 2026",
            excerpt: "Explore the traditional remedies using indigenous spices and herbs.",
            category: "Health"
        },
        {
            title: "Cooking Tips with Organic Oils",
            date: "April 1, 2026",
            excerpt: "Maximize the health benefits of cooking oils in your daily meals.",
            category: "Tips"
        }
    ];

    return (
        <div className="py-12">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Blog</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {blogs.map((blog, index) => (
                    <div key={index} className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="bg-gray-100 h-48 flex items-center justify-center">
                            <span className="text-gray-400">Blog Image</span>
                        </div>
                        <div className="p-4">
                            <span className="text-xs text-emerald-600 font-medium">{blog.category}</span>
                            <h2 className="font-semibold text-gray-800 mt-1">{blog.title}</h2>
                            <p className="text-sm text-gray-500 mt-2">{blog.date}</p>
                            <p className="text-gray-600 mt-2">{blog.excerpt}</p>
                            <a href="#" className="text-emerald-600 hover:underline mt-3 inline-block">Read More</a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}