import axios from 'axios';

async function test() {
    const API_BASE = 'http://localhost:3000/api/v1/robotkez';
    const instruction = 'Navigálj a google.com-ra és keress rá az "AI hírek" kifejezésre';

    try {
        console.log('Sending request...');
        const response = await axios.post(`${API_BASE}/chat`, { instruction });
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        if (error.response) {
            console.log('Error Status:', error.response.status);
            console.log('Error Data:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }
}

test();
