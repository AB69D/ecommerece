"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function DashboardPage() {
    const router = useRouter();
    const { store } = useParams() || {};

    useEffect(() => {
        if (store) {
            router.replace(`/${store}/admin`);
        }
    }, [store, router]);

    return null;
}
