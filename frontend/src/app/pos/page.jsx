"use client";
import { useState, useEffect, useCallback } from "react";
import { posFetchMe, clearPosToken } from "@/services/pos";
import PosLogin from "./PosLogin";
import PosTerminal from "./PosTerminal";

export default function PosPage() {
    const [me, setMe] = useState(null);
    const [checking, setChecking] = useState(true);

    const loadMe = useCallback(async () => {
        const res = await posFetchMe();
        if (res?.success && res.data) {
            setMe(res.data);
        } else {
            setMe(null);
        }
        setChecking(false);
    }, []);

    useEffect(() => {
        loadMe();
    }, [loadMe]);

    // Drop back to login whenever a POS request reports 401.
    useEffect(() => {
        const onUnauth = () => {
            clearPosToken();
            setMe(null);
        };
        window.addEventListener("pos:unauthorized", onUnauth);
        return () => window.removeEventListener("pos:unauthorized", onUnauth);
    }, []);

    const logout = useCallback(() => {
        clearPosToken();
        setMe(null);
    }, []);

    if (checking) {
        return (
            <div className="fixed inset-0 z-[60] bg-slate-950 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-slate-700 border-t-teal-400 rounded-full animate-spin" />
            </div>
        );
    }

    if (!me) {
        return <PosLogin onLoggedIn={loadMe} />;
    }

    return <PosTerminal me={me} onLogout={logout} />;
}
