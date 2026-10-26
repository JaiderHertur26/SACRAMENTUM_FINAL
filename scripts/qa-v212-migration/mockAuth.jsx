import React,{createContext,useContext,useEffect,useState} from 'react';
const C=createContext(null);export function MockAuthProvider({children}){const[user,setUser]=useState({id:'fake-diocese',role:'diocese',dioceseId:'diocese-A',dioceseName:'DIOCESIS FICTICIA'});
useEffect(()=>{window.__qa212.setRole=(role,dioceseId='diocese-A')=>setUser(x=>({...x,role,dioceseId}));},[]);
return <C.Provider value={{user,profile:{role:user.role,diocese_id:user.dioceseId}}}>{children}</C.Provider>};export const useAuth=()=>useContext(C);