// Kept as an explicit tombstone: no legacy event can activate new purchases.
export async function POST(){return Response.json({error:'A cobrança do Giro foi migrada para Stripe.'},{status:410});}
