export function manualCoordinatesBrowser(evaluate, pause) {
  const selector = '[role="dialog"][aria-label^="Asentar"]';
  const exists = () => evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
  const error = () => evaluate(`document.querySelector(${JSON.stringify(selector)})?.querySelector('[role=alert]')?.textContent || ''`);

  async function open() {
    for (let attempt = 0; attempt < 70; attempt++) {
      if (await exists() === 1) return;
      await pause(60);
    }
    throw new Error('No se abrió un único formulario de coordenadas');
  }

  async function action(text) {
    return evaluate(`(()=>{const dialog=document.querySelector(${JSON.stringify(selector)});
      const button=[...dialog.querySelectorAll('button')].find(node=>node.textContent.trim()===${JSON.stringify(text)});
      if(!button||button.disabled)throw Error('No está disponible el botón del formulario');
      button.click();return true})()`);
  }

  async function fill({book, folio, number}) {
    await evaluate(`(()=>{const dialog=document.querySelector(${JSON.stringify(selector)});
      for(const [name,value] of Object.entries(${JSON.stringify({book,folio,number})})){
        const input=dialog.querySelector('input[name="'+name+'"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));
        input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      return true})()`);
  }

  return { open, exists, error, fill, submit: () => action('Asentar'), cancel: () => action('Cancelar') };
}
