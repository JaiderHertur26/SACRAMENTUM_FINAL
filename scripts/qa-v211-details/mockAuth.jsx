import React,{createContext,useContext,useEffect,useState} from 'react';
const C=createContext(null);export function MockAuthProvider({children}){const[user,setUser]=useState({id:'qa-persona',role:'parish',parishId:'parish-one',parishName:'PARROQUIA FICTICIA UNO',dioceseName:'DIOCESIS FICTICIA'});
useEffect(()=>{window.__qa211.setParish=parishId=>setUser(x=>({...x,parishId,parishName:'PARROQUIA QA '+parishId}))},[]);
return <C.Provider value={{user}}>{children}</C.Provider>};export const useAuth=()=>useContext(C);