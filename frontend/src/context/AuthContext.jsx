import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const check = async () => {
        const token = localStorage.getItem("eha_token");
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const { data } = await api.get("/auth/me");
            setUser(data);
        } catch (e) {
            localStorage.removeItem("eha_token");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        check();
    }, []);

    const login = async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        localStorage.setItem("eha_token", data.access_token);
        setUser(data.user);
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem("eha_token");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, token: localStorage.getItem("eha_token") }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
