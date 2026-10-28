import { supabase } from '@/lib/supabaseClient';

/** RPC independiente para la bandeja receptora. No carga servicios de emisión ni archivos. */
export async function updatePhysicalLocatorV277({recipientId,book,folio,number,reference}) {
  if(!recipientId||!book?.trim()||!folio?.trim()||!number?.trim()||reference?.trim().length<8) {
    throw new Error('Libro, folio, número y referencia de cotejo obligatorios');
  }
  const {data,error}=await supabase.rpc('update_sacramental_physical_locator_v277',{
    p_recipient_id:recipientId,p_book:book.trim(),p_folio:folio.trim(),
    p_number:number.trim(),p_reference:reference.trim()
  });
  if(error) throw error;
  return data;
}
