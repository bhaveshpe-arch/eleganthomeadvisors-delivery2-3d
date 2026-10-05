import api from "@/lib/api";

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Requests notification permission, subscribes this browser to push, and registers
// the subscription with the backend so it can be targeted for this employee's leads.
export async function enablePushNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push notifications aren't supported on this browser");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        throw new Error("Notification permission was not granted");
    }
    const { data } = await api.get("/push/public-key");
    if (!data.public_key) {
        throw new Error("Push isn't configured on the server yet");
    }
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.public_key),
        });
    }
    await api.post("/push/subscribe", subscription.toJSON());
    return true;
}

export async function isPushEnabled() {
    if (!("serviceWorker" in navigator)) return false;
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
}
