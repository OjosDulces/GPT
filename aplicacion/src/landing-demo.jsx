import React from 'react';
import {createRoot} from 'react-dom/client';
import Landing from './components/Landing.jsx';
import './index.css';
function OfflineLanding(){
 function navigate(e){const link=e.target.closest('a');if(!link)return;const href=link.getAttribute('href');if(href?.startsWith('/')){e.preventDefault();window.location.href=href.includes('demo=1')?'ABRIR_DEMO.html':href.startsWith('/app')?'EMPIEZA_AQUI.html#activar':'PAGINA_COMERCIAL.html';}}
 return <div onClick={navigate}><Landing/></div>;
}
createRoot(document.getElementById('root')).render(<OfflineLanding/>);
