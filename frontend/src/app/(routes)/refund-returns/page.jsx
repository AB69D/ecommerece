export default function RefundReturnsPage() {
    return (
        <div className="py-8 px-4 max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-8">Refund & Returns Policy</h1>
            
            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-8">
                {/* Introduction */}
                <div>
                    <p className="text-gray-600 leading-relaxed">
                        Thank you for shopping with Ab9dEcommerce. We truly value your trust and strive to provide 
                        high-quality products along with reliable customer service. Our goal is to ensure you have a 
                        satisfying experience with every purchase.
                    </p>
                    <p className="text-gray-600 leading-relaxed mt-4">
                        Due to the nature of our products and current market conditions, returns and refunds are 
                        handled according to the guidelines below.
                    </p>
                </div>

                {/* Return Policy */}
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Return Policy</h2>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                        <p className="text-gray-700">
                            We kindly request you to check your order carefully in front of the delivery personnel at the 
                            time of receiving it. If you notice any problem or mismatch, please contact us immediately at{' '}
                            <a href="tel:+1 000 000 0000" className="text-emerald-600 font-semibold hover:underline">01822-858380</a>.
                        </p>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Eligible Reasons for Return</h3>
                    <ul className="space-y-2">
                        {[
                            'The product is expired or physically damaged',
                            'The item differs from what was shown on our website or social media pages',
                            'The quality does not match the described standard',
                            'There are issues related to delivery',
                            'The product weight is inaccurate',
                            'You received the wrong item'
                        ].map((item, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                                    •
                                </span>
                                <span className="text-gray-600">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Refund Policy */}
                <div className="border-t border-gray-200 pt-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Refund Policy</h2>
                    <p className="text-gray-600 leading-relaxed mb-4">
                        Ab9dEcommerce offers a customer-friendly policy where you can try our product and request a 
                        refund within <strong>10 days</strong> from the delivery date if you are not satisfied.
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                        <p className="text-gray-700">
                            If any portion of the product has been used, the cost of the used amount will be deducted 
                            from the refund.
                        </p>
                    </div>
                    <p className="text-gray-600">
                        For assistance, feel free to call us at{' '}
                        <a href="tel:+1 000 000 0000" className="text-emerald-600 font-semibold hover:underline">01822-858380</a>.
                    </p>
                </div>

                {/* Refund Conditions */}
                <div className="border-t border-gray-200 pt-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Refund Conditions</h2>
                    <ul className="space-y-3">
                        {[
                            'Refunds will be processed within 3 days after we receive the returned product',
                            'Products must be returned in proper packaging',
                            'Delivery/return charges will be adjusted from the refund amount'
                        ].map((item, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                    {index + 1}
                                </span>
                                <span className="text-gray-600 pt-0.5">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Closing Statement */}
                <div className="border-t border-gray-200 pt-8">
                    <p className="text-gray-600 leading-relaxed italic">
                        We believe that a clear and fair return policy helps build strong relationships with 
                        customers. At Ab9dEcommerce, we are committed to handling all return and refund requests 
                        professionally and efficiently to ensure your satisfaction.
                    </p>
                </div>
            </div>
        </div>
    );
}
