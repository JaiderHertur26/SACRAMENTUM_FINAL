import React,{useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {AuthProvider,useAuth} from '@/context/AuthContext';import {supabase} from '@/lib/supabaseClient';import '@/index.css';
window.__qa208={ready:false,result:null,events:[]};
supabase.auth.onAuthStateChange(event=>window.__qa208.events.push(event));
function Probe(){
 const auth=useAuth();
 useEffect(()=>{
  const q=window.__qa208;
  q.ready=true;
  q.state={authenticated:auth.isAuthenticated,userId:auth.user?.id||null,role:auth.role,profileActive:auth.profile?.is_active||false,configurationError:auth.configurationError,sessionUserId:auth.session?.user?.id||null};
  q.startLogin=(email,password)=>{q.result=null;auth.login(email,password).then(result=>q.result=result).catch(error=>q.result={success:false,error:error.message});return true};
  q.logout=()=>{void auth.logout();return true};
  q.signOut=()=>{q.result=null;supabase.auth.signOut({scope:'local'}).then(({error})=>q.result={signedOut:!error});return true};
  q.refresh=()=>{q.result=null;supabase.auth.refreshSession().then(({error})=>q.result={refreshed:!error});return true};
  q.clearStorage=()=>{localStorage.clear();return true};
 },[auth]);
 return <main><h1>QA V208 Auth real</h1><pre>{JSON.stringify(window.__qa208.state)}</pre></main>;
}
createRoot(document.getElementById('root')).render(<AuthProvider><Probe/></AuthProvider>);