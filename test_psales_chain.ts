import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:3000/api/v1/webhook/onboarding-intake';
const SECRET = process.env.BRUNELLA_WEBHOOK_SECRET;

async function testFullChain() {
  console.log('--- Phase 1 & 2 Full Chain Test ---');
  
  try {
    // 1. Submit Intake
    console.log('1. Submitting intake...');
    const intakeRes = await axios.post(BASE_URL, {
      client_name: 'Zala-Gép Kft.',
      email: 'vezeto@zalagep.hu',
      industry: 'Gépgyártás',
      pain_point: 'Nincs elég új B2B partner, manuális a keresés',
      form_type: 'kkv_general'
    }, {
      headers: { 'X-Brunella-Token': SECRET }
    });
    
    const jobId = intakeRes.data.job_id;
    console.log('Intake submitted. Job ID:', jobId);

    // 2. Approve Intake (Triggers LeadMiningAgent)
    console.log('2. Approving intake...');
    const approveRes = await axios.post(`${BASE_URL}/${jobId}/approve`, {}, {
      headers: { 'X-Brunella-Token': SECRET }
    });
    
    console.log('Approval response:', approveRes.data.message);
    console.log('Task ID:', approveRes.data.queued_task_id);

    console.log('Chain test initiated successfully. Check logs for agent execution and Sheets sync.');
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testFullChain();
