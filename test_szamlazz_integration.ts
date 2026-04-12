import { SzamlazzHuAgent } from './src/agents/SzamlazzHuAgent.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSzamlazz() {
  console.log('--- Számlázz.hu Integrációs Teszt ---');
  
  if (!process.env.SZAMLAZZ_HU_API_KEY) {
    console.error('Hiba: SZAMLAZZ_HU_API_KEY nincs beállítva a .env-ben!');
    return;
  }

  const agent = new SzamlazzHuAgent();
  
  // Minimális tesztadatok
  const payload = {
    customer: {
      name: 'Teszt Vevő Kft.',
      zip: '1011',
      city: 'Budapest',
      address: 'Fő utca 1.',
      email: 'pohankaestarsa+test@gmail.com',
      taxNumber: '12345678-1-11'
    },
    details: {
      paymentMethod: 'Átutalás',
      currency: 'HUF',
      language: 'hu',
      comment: 'Ez egy automatikus teszt számla a Brunella Agent System-ből.'
    },
    items: [
      {
        name: 'AI Konzultáció (Teszt)',
        quantity: 1,
        unit: 'db',
        netUnitPrice: 100,
        vatRate: '27',
        netAmount: 100,
        vatAmount: 27,
        grossAmount: 127
      }
    ]
  };

  try {
    console.log('Számla kiállításának kísérlete...');
    const result = await agent.executeTask({
      task: 'create invoice',
      payload: payload
    });

    if (result.success) {
      console.log('✅ SIKER!');
      console.log('Üzenet:', result.message);
      console.log('Számlaszám:', result.data.invoiceNumber);
      if (result.data.pdfBase64) {
        console.log('PDF adat megérkezett (Base64 kódolva).');
      }
    } else {
      console.error('❌ HIBA a Számlázz.hu-tól:');
      console.error(result.message);
      console.log('Részletek:', JSON.stringify(result.data, null, 2));
    }
  } catch (error) {
    console.error('🔴 Végzetes hiba a futtatás során:', error);
  }
}

testSzamlazz();
