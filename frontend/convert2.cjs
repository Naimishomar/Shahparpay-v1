const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const workbook = xlsx.readFile(path.join(__dirname, 'src', 'data', 'State_And_District.xlsx'));

const districtSheet = workbook.Sheets['First Sheet'];
const stateSheet = workbook.Sheets['First Sheet (2)'];

const districtData = xlsx.utils.sheet_to_json(districtSheet);
const stateData = xlsx.utils.sheet_to_json(stateSheet);

const stateMap = {};

stateData.forEach(s => {
    const sId = String(s.id).trim();
    const sName = String(s.name).trim();
    if (sId && sName) {
        stateMap[sId] = {
            id: sId,
            name: sName,
            districts: []
        };
    }
});

districtData.forEach(d => {
    const sId = String(d.state_id).trim();
    const dId = String(d.id).trim();
    const dName = String(d.name).trim();

    if (sId && dId && dName && stateMap[sId]) {
        stateMap[sId].districts.push({
            id: dId,
            name: dName
        });
    }
});

const formattedData = Object.values(stateMap);

// Sort states alphabetically
formattedData.sort((a, b) => a.name.localeCompare(b.name));
// Sort districts alphabetically
formattedData.forEach(s => {
    s.districts.sort((a, b) => a.name.localeCompare(b.name));
});

fs.writeFileSync(path.join(__dirname, 'src', 'data', 'locations.json'), JSON.stringify(formattedData, null, 2));
console.log("Mapped and dumped to src/data/locations.json");
