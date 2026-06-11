import AdminSignIn from "@/components/AdminSignIn";

export const metadata = {
    title: "Platform sign in",
    robots: { index: false, follow: false },
};

// Bare base URL = the platform owner's sign-in. A store owner who lands here is
// still routed to their own /<store>/admin (the destination follows the account).
export default function PlatformLoginPage() {
    return <AdminSignIn variant="platform" />;
}
