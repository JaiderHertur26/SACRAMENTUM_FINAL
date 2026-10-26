import React,{createContext,useContext,useEffect,useState}from'react';
const C=createContext(null);
export function MockAuthProvider({children}){const[user,setUser]=useState(window.__qa218.user);
useEffect(()=>{window.__qa218.changeUser=(next)=>{window.__qa218.user=next;setUser(next);};},[]);
return <C.Provider value={{user}}>{children}</C.Provider>}
export const useAuth=()=>useContext(C);