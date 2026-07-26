const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const workbook = xlsx.readFile(path.join(__dirname, 'src', 'data', 'District_Masters.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet);

// Structure the data:
// [ { id: "State Code", name: "State Name", districts: [ { id: "District Code", name: "District Name" } ] } ]
const stateMap = {};

data.forEach(row => {
    const sId = String(row['State Code']).trim();
    const sName = String(row['State Name']).trim();
    const dId = String(row['District Code']).trim();
    const dName = String(row['District Name']).trim();

    if (!sId || !sName) return;

    if (!stateMap[sId]) {
        stateMap[sId] = {
            id: sId,
            name: sName,
            districts: []
        };
    }

    if (dId && dName) {
        stateMap[sId].districts.push({
            id: dId,
            name: dName
        });
    }
});

const formattedData = Object.values(stateMap);

// Write to final location
fs.writeFileSync(path.join(__dirname, 'src', 'data', 'locations.json'), JSON.stringify(formattedData, null, 2));
console.log("Dumped to src/data/locations.json");
