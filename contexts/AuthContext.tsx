import { createContext, ReactNode, useEffect, useState } from "react";
import { destroyCookie, parseCookies, setCookie } from 'nookies'
import Router from "next/router";
import { api } from "../services/apiClient";

type User = {
    email: string;
    permissions: string[];
    roles: string[];
};

type SignInCredentials = {
    email: string;
    password: string;
}

type AuthContextData = {
    signIn: (credentials: SignInCredentials) => Promise<void>;
    signOut: () => void;
    user: User;
    isAuthenticated: boolean;
};

type AuthProviderProps = {
    children: ReactNode;
}

export const AuthContext = createContext({} as AuthContextData)

let authChannel: BroadcastChannel;

export function signOut(broadcast: boolean = true) {
    destroyCookie(undefined, 'nextauth.token');
    destroyCookie(undefined, 'nextauth.refreshToken');
    if (broadcast){
        authChannel.postMessage('signOut');   
    } 

    Router.push('/');
}

export  function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User>();
    const isAuthenticated = !!user;
    //toda vez que o user acessar pela 1 vez, carregar a informação do usuario novamente

    useEffect(() => {
        authChannel = new BroadcastChannel('auth');

        authChannel.onmessage = async (message) => {
            console.log(message);
            switch (message.data) {
                case 'signOut':
                     signOut(false);
                    //authChannel.close();
                    break;
                case "signIn":
                    //Router.push('/dashboard');
                    break;
                default:
                    break;
            }
        };
    }, []);

    useEffect(() => {
        const { 'nextauth.token': token } = parseCookies()

        if (token) { // se tiver ja um token salvo no navegador
            api.get('/me').then(response => {
                const { email, permissions, roles } = response.data

                setUser({ email, permissions, roles })
            })
                .catch(() => {
                    signOut();
                })
        }
    }, [])

    async function signIn({ email, password }: SignInCredentials) {
        try {
            const response = await api.post('sessions', {
                email,
                password
            })

            const { token, refreshToken, permissions, roles } = response.data;

            setCookie(undefined, 'nextauth.token', token, {// nextauth pode ser o nome do app
                maxAge: 60 * 60 * 24 * 30, // 30 dias quem vai ser responsavel por renovar o token nao vai ser o browser
                path: '/' // qualquer endereço da aplicação tem acesso a essa token
            })
            setCookie(undefined, 'nextauth.refreshToken', refreshToken, {
                maxAge: 60 * 60 * 24 * 30,
                path: '/'
            })

            setUser({
                email,
                permissions,
                roles,
            })

            api.defaults.headers["Authorization"] = `Bearer ${token}`;

            Router.push("/dashboard");
            authChannel.postMessage("signIn"); 
        } catch (err) {
            console.log(err);
        }
    }

    return (
        <AuthContext.Provider value={{ signIn, signOut, isAuthenticated, user }}>
            {children}
        </AuthContext.Provider>
    )
}