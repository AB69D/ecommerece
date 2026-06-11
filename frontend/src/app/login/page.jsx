import AdminSignIn from "@/components/AdminSignIn";

export const metadata = {
    title: "Sign in to your store",
    robots: { index: false, follow: false },
};

// Global store-owner login. Usernames are unique across the whole platform, so we
// find the owner's store from their credentials and send them to /<store>/admin.
export default function StoreLoginPage() {
    return <AdminSignIn variant="store" />;
}
