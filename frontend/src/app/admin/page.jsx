"use client";
import Image from "next/image";

export default function AdminDashboard() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center">
            <div className="text-center space-y-6">
                <div className="flex justify-center">
                    <Image
                        src="/logo.png"
                        alt="Gram2Ghor Logo"
                        width={200}
                        height={200}
                        className="object-contain w-40 sm:w-48 md:w-56"
                        priority
                    />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800">
                        Welcome to Admin Dashboard
                    </h1>
                    <p className="text-gray-500 text-sm sm:text-base md:text-lg">
                        Manage your Gram2Ghor store efficiently
                    </p>
                </div>
            </div>
        </div>
    )
}