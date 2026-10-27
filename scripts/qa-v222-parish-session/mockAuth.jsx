import React,{createContext,useContext,useEffect,useState} from 'react';
const C=createContext(null);
const initialUser={id:'auth-a',role:'parish',parishId:'parish-a',parish_id:'parish-a',dioceseId:'diocese-a',diocese_id:'diocese-a',parishName:'Parroquia A'};
const initialProfile={id:'profile-a',auth_user_id:'auth-a',role:'parish',parish_id:'parish-a',diocese_id:'diocese-a',status:'ACTIVE',is_active:true};
export const fixture=(letter)=>({user:{...initialUser,id:'auth-'+letter,parishId:'parish-'+letter,parish_id:'parish-'+letter,dioceseId:'diocese-'+letter,diocese_id:'diocese-'+letter,parishName:'Parroquia '+letter.toUpperCase()},profile:{...initialProfile,id:'profile-'+letter,auth_user_id:'auth-'+letter,parish_id:'parish-'+letter,diocese_id:'diocese-'+letter}});
export function MockAuthProvider({children}){
 const [auth,setAuth]=useState({user:initialUser,profile:initialProfile});
 useEffect(()=>{window.__qa222.changeUser=(x)=>setAuth(typeof x==='string'?fixture(x):x)},[]);
 return <C.Provider value={auth}>{children}</C.Provider>;
}
export const useAuth=()=>useContext(C);