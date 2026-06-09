"use client";
import { authFetch } from "@/services/api";
import React, { useState, useEffect } from "react";
import { FiUploadCloud, FiPlus, FiTrash2, FiChevronDown, FiChevronUp } from "react-icons/fi";

export default function CreateProductPage() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [categories, setCategories] = useState([]);
    const [weights, setWeights] = useState([{ weight: "", stock: "", price: "", images: [] }]);
    const [coverImage, setCoverImage] = useState(null);
    const [coverImagePreview, setCoverImagePreview] = useState("");
    const [qaList, setQaList] = useState([{ question: "", answer: "" }]);
    const [qaExpanded, setQaExpanded] = useState(true);
    const [showInEcommerce, setShowInEcommerce] = useState(true);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await authFetch(`/api/admin/category/get-all-category`);
                const data = await res.json();
                if (data.success) {
                    setCategories(data.data);
                }
            } catch (error) {
                console.error("Failed to fetch categories:", error);
            }
        };
        fetchCategories();
    }, []);

    const handleCoverImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCoverImage(file);
            setCoverImagePreview(URL.createObjectURL(file));
        }
    };

    const handleWeightImageChange = (index, e) => {
        const files = Array.from(e.target.files);
        const newWeights = [...weights];
        newWeights[index].images = files;
        setWeights(newWeights);
    };

    const addWeight = () => {
        setWeights([...weights, { weight: "", stock: "", price: "", images: [] }]);
    };

    const removeWeight = (index) => {
        const newWeights = weights.filter((_, i) => i !== index);
        setWeights(newWeights);
    };

    const updateWeight = (index, field, value) => {
        const newWeights = [...weights];
        newWeights[index][field] = value;
        setWeights(newWeights);
    };

    const addQA = () => {
        setQaList([...qaList, { question: "", answer: "" }]);
    };

    const removeQA = (index) => {
        const newQA = qaList.filter((_, i) => i !== index);
        setQaList(newQA);
    };

    const updateQA = (index, field, value) => {
        const newQA = [...qaList];
        newQA[index][field] = value;
        setQaList(newQA);
    };

    const handleProductSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        const filteredQA = qaList.filter(qa => qa.question.trim() && qa.answer.trim());

        const formData = new FormData();

        formData.append("cover_image", coverImage);
        formData.append("firstName", e.target.firstName.value);
        formData.append("lastName", e.target.lastName.value);
        formData.append("category", e.target.category.value);
        formData.append("weights", JSON.stringify(weights.map(w => ({
            weight: w.weight,
            stock: parseInt(w.stock) || 0,
            price: parseFloat(w.price) || 0
        }))));
        formData.append("description", e.target.description.value);
        formData.append("qa", JSON.stringify(filteredQA));
        formData.append("showInEcommerce", showInEcommerce);

        weights.forEach((weight, index) => {
            weight.images.forEach((file) => {
                formData.append(`weight_images_${index}`, file);
            });
        });

        try {
            const res = await authFetch(`/api/admin/product/upload-product`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            
            if (data.success) {
                setMessage(`Success: ${data.message}`);
                e.target.reset();
                setWeights([{ weight: "", stock: "", price: "", images: [] }]);
                setCoverImage(null);
                setCoverImagePreview("");
                setQaList([{ question: "", answer: "" }]);
                setShowInEcommerce(true);
            } else {
                setMessage(`Error: ${data.message}`);
            }
        } catch (error) {
            setMessage("Failed to submit. Please check your connection.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Create Product</h3>
            
            {message && (
                <div className={`p-3 sm:p-4 mb-4 sm:mb-6 rounded-lg font-medium text-xs sm:text-sm border ${
                    message.startsWith("Success") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                }`}>
                    {message}
                </div>
            )}

            <form onSubmit={handleProductSubmit} className="flex flex-col gap-4 sm:gap-5">
                <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Cover Image</label>
                    <div className="border border-dashed border-gray-300 rounded-lg p-3 sm:p-4 bg-gray-50 text-center hover:bg-gray-100 transition cursor-pointer">
                        <input 
                            type="file" 
                            name="cover_image" 
                            accept="image/*" 
                            onChange={handleCoverImageChange}
                            className="w-full text-xs sm:text-sm text-gray-500 file:mr-2 sm:file:mr-4 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" 
                        />
                    </div>
                    {coverImagePreview && (
                        <div className="mt-2">
                            <img src={coverImagePreview} alt="Cover Preview" className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 object-cover rounded-lg" />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 sm:gap-5">
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Product First Name</label>
                        <input 
                            type="text" 
                            name="firstName" 
                            required 
                            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 text-xs sm:text-sm" 
                            placeholder="e.g. Pure Mustard Oil" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Product Last Name</label>
                        <input 
                            type="text" 
                            name="lastName" 
                            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 text-xs sm:text-sm" 
                            placeholder="e.g. Premium Grade" 
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Category</label>
                    <select 
                        name="category" 
                        required 
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 text-xs sm:text-sm"
                    >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                            <option key={cat._id} value={cat._id}>
                                {cat.category_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Visibility</label>
                    <label className="flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 border border-gray-300 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition">
                        <input
                            type="checkbox"
                            checked={showInEcommerce}
                            onChange={(e) => setShowInEcommerce(e.target.checked)}
                            className="mt-0.5 w-4 h-4 sm:w-5 sm:h-5 accent-emerald-600 shrink-0"
                        />
                        <span className="text-xs sm:text-sm">
                            <span className="font-medium text-gray-800 block">Show on e-commerce storefront</span>
                            <span className="text-gray-500">
                                {showInEcommerce
                                    ? "Visible to online shoppers and sellable at the POS."
                                    : "Hidden from the website — available at the POS terminal only."}
                            </span>
                        </span>
                    </label>
                </div>

                <div className="border-t pt-4 sm:pt-5">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <h4 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">Product Weights</h4>
                        <button 
                            type="button" 
                            onClick={addWeight}
                            className="flex items-center gap-1 text-xs sm:text-sm text-emerald-600 hover:text-emerald-700"
                        >
                            <FiPlus className="w-3 h-3 sm:w-4 sm:h-4" /> Add Weight
                        </button>
                    </div>

                    {weights.map((weight, index) => (
                        <div key={index} className="bg-gray-50 p-3 sm:p-4 rounded-lg mb-3 sm:mb-4 border">
                            <div className="flex items-center justify-between mb-2 sm:mb-3">
                                <span className="text-xs sm:text-sm font-medium text-gray-600">Weight {index + 1}</span>
                                {weights.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => removeWeight(index)}
                                        className="text-red-500 hover:text-red-600"
                                    >
                                        <FiTrash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 mb-2 sm:mb-3">
                                <div>
                                    <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Weight</label>
                                    <input 
                                        type="text" 
                                        value={weight.weight}
                                        onChange={(e) => updateWeight(index, "weight", e.target.value)}
                                        required
                                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 text-xs sm:text-sm" 
                                        placeholder="e.g. 1kg, 500ml" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Stock</label>
                                    <input 
                                        type="number" 
                                        value={weight.stock}
                                        onChange={(e) => updateWeight(index, "stock", e.target.value)}
                                        required
                                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 text-xs sm:text-sm" 
                                        placeholder="100" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Price ($)</label>
                                    <input 
                                        type="number" 
                                        value={weight.price}
                                        onChange={(e) => updateWeight(index, "price", e.target.value)}
                                        required
                                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 text-xs sm:text-sm" 
                                        placeholder="850" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Images for {weight.weight || 'this weight'}</label>
                                <div className="border border-dashed border-gray-300 rounded-lg p-2 sm:p-3 bg-white text-center">
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept="image/*"
                                        onChange={(e) => handleWeightImageChange(index, e)}
                                        className="w-full text-[10px] sm:text-xs text-gray-500 file:mr-1 sm:file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] sm:file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" 
                                    />
                                </div>
                                {weight.images.length > 0 && (
                                    <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
                                        {Array.from(weight.images).map((file, i) => (
                                            <span key={i} className="text-[10px] sm:text-xs bg-emerald-100 text-emerald-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                                                {file.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Description</label>
                    <textarea 
                        name="description" 
                        rows={4}
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 resize-none text-xs sm:text-sm" 
                        placeholder="Details about product..." 
                    />
                </div>

                <div className="border-t pt-4 sm:pt-5">
                    <button
                        type="button"
                        onClick={() => setQaExpanded(!qaExpanded)}
                        className="flex items-center justify-between w-full mb-3 sm:mb-4"
                    >
                        <h4 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">Question & Answer</h4>
                        {qaExpanded ? (
                            <FiChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                        ) : (
                            <FiChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                        )}
                    </button>

                    {qaExpanded && (
                        <div className="space-y-3 sm:space-y-4">
                            {qaList.map((qa, index) => (
                                <div key={index} className="bg-gray-50 p-3 sm:p-4 rounded-lg border">
                                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                                        <span className="text-xs sm:text-sm font-medium text-gray-600">Q&A {index + 1}</span>
                                        {qaList.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeQA(index)}
                                                className="text-red-500 hover:text-red-600"
                                            >
                                                <FiTrash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2 sm:space-y-3">
                                        <div>
                                            <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Question</label>
                                            <input 
                                                type="text" 
                                                value={qa.question}
                                                onChange={(e) => updateQA(index, "question", e.target.value)}
                                                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 text-xs sm:text-sm" 
                                                placeholder="e.g. Is this product quality?" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Answer</label>
                                            <textarea 
                                                value={qa.answer}
                                                onChange={(e) => updateQA(index, "answer", e.target.value)}
                                                rows={2}
                                                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 text-xs sm:text-sm resize-none" 
                                                placeholder="e.g. Yes, this product is 100% quality certified." 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button 
                                type="button" 
                                onClick={addQA}
                                className="flex items-center gap-1 text-xs sm:text-sm text-emerald-600 hover:text-emerald-700"
                            >
                                <FiPlus className="w-3 h-3 sm:w-4 sm:h-4" /> Add More Q&A
                            </button>
                        </div>
                    )}
                </div>

                <button type="submit" disabled={loading} className="mt-4 sm:mt-6 flex items-center justify-center gap-2 w-full bg-emerald-600 text-white font-medium py-2.5 sm:py-3 rounded-lg shadow hover:bg-emerald-700 disabled:opacity-70 transition text-xs sm:text-sm">
                    <FiUploadCloud className="w-4 h-4 sm:w-5 sm:h-5" /> {loading ? "Uploading..." : "Upload Product"}
                </button>
            </form>
        </div>
    );
}