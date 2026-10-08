// Synthetic provider: no external network and no real credentials or charges.
export default {async fetch(request){
 const url=new URL(request.url);
 if(url.hostname!=='api.mercadopago.com')return Response.json({id:456});
 if(request.headers.get('authorization')!=='Bearer TEST-runtime-fixture')return new Response('',{status:401});
 if(url.pathname==='/v1/payments/456')return new Response('',{status:302,headers:{Location:'https://unexpected.example/redirect'}});
 if(url.pathname==='/v1/payments/789')return new Response('',{status:401});
 if(url.pathname==='/v1/payments/123')return Response.json({id:123});
 return new Response('',{status:404});
}};
