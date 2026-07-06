import axios from 'axios';
import xlsx from 'xlsx';
import fs from 'fs';

async function fetchBanks() {
    try {
        console.log("Downloading Excel file...");
        const res = await axios.get('https://paysprint.in/assets/DMT-BANK-LIST.xlsx', {responseType: 'arraybuffer'});
        console.log("Parsing Excel file...");
        const wb = xlsx.read(res.data);
        const sheetName = wb.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
        
        fs.writeFileSync('src/data/dmt_banks.json', JSON.stringify(data, null, 2));
        console.log(`Successfully extracted ${data.length} banks to src/data/dmt_banks.json`);
    } catch (e) {
        console.error("Failed to fetch/parse:", e.message);
    }
}
fetchBanks();
