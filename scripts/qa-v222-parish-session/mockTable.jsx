import React from 'react';
export default function TablaAvisos({avisos,onViewAviso}){
 return <div>{avisos.map(x=><button key={x.id} type="button" onClick={()=>onViewAviso(x)}>{x.personName||x.id}</button>)}</div>;
}