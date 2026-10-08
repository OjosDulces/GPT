// Browser-only UI fixture. Native signature, expiry and network tests live in
// test-licensed-electron.mjs and tests/license-client.test.js. Never bundled.
export async function installLicenseFixture(page){await page.addInitScript(()=>{
 const state={status:'trial',canWrite:true,canRead:true,canExport:true,mode:'test',trialEndsAt:Date.now()+15*86400000,verifyBefore:Date.now()+7*86400000,paidUntil:null,daysRemaining:15,billingEnabled:true,checking:false};
 window.desktopLicense={status:async()=>state,refresh:async()=>state,authorizeWrite:async()=>state,onChange:()=>()=>{},checkout:async()=>{throw Error('Esta prueba de interfaz no abre pagos.');}};
});}
