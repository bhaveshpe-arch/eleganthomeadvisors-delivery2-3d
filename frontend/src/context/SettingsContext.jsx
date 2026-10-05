import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(null);

    const load = async () => {
        try {
            const { data } = await api.get("/settings");
            setSettings(data);
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, reload: load, setSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const ctx = useContext(SettingsContext);
    return ctx || { settings: null };
};
