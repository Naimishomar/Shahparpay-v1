const xlsx = require('xlsx');
const path = require('path');

const workbook = xlsx.readFile(path.join(__dirname, 'src', 'data', 'State_And_District.xlsx'));
console.log("Sheets:", workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`\n--- First row of ${sheetName} ---`);
    console.log(data[0]);
});
