import React from 'react';
export default function MockModal({isOpen,aviso,receipt}){
 return isOpen?<section data-qa-modal>{aviso?.personName||receipt?.personName||'Modal visible'}</section>:null;
}