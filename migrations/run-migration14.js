const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  // { state: [ [district, [cities...]], ... ] }
  const data = {
    'Maharashtra': [['Pune', ['Pune', 'Pimpri-Chinchwad']], ['Mumbai', ['Mumbai', 'Thane']], ['Nagpur', ['Nagpur']]],
    'Delhi': [['New Delhi', ['New Delhi', 'Dwarka', 'Rohini']]],
    'Karnataka': [['Bengaluru', ['Bengaluru', 'Whitefield']], ['Mysuru', ['Mysuru']]],
    'Tamil Nadu': [['Chennai', ['Chennai']], ['Coimbatore', ['Coimbatore']]],
    'Telangana': [['Hyderabad', ['Hyderabad', 'Secunderabad']]],
    'Uttar Pradesh': [['Lucknow', ['Lucknow']], ['Noida', ['Noida']], ['Kanpur', ['Kanpur']]],
    'Gujarat': [['Ahmedabad', ['Ahmedabad']], ['Surat', ['Surat']]],
    'Rajasthan': [['Jaipur', ['Jaipur']], ['Jodhpur', ['Jodhpur']]],
    'West Bengal': [['Kolkata', ['Kolkata']]],
    'Madhya Pradesh': [['Indore', ['Indore']], ['Bhopal', ['Bhopal']]],
    'Punjab': [['Ludhiana', ['Ludhiana']], ['Amritsar', ['Amritsar']]],
    'Haryana': [['Gurugram', ['Gurugram']], ['Faridabad', ['Faridabad']]],
    'Kerala': [['Kochi', ['Kochi']], ['Thiruvananthapuram', ['Thiruvananthapuram']]],
    'Bihar': [['Patna', ['Patna']]],
    'Odisha': [['Bhubaneswar', ['Bhubaneswar']]],
    'Assam': [['Guwahati', ['Guwahati']]],
    'Andhra Pradesh': [['Visakhapatnam', ['Visakhapatnam']], ['Vijayawada', ['Vijayawada']]],
    'Chandigarh': [['Chandigarh', ['Chandigarh']]],
  };

  for (const [stateName, districts] of Object.entries(data)) {
    let [stateRows] = await conn.query('SELECT state_id FROM states WHERE state_name = ?', [stateName]);
    let stateId;
    if (stateRows.length === 0) {
      const [res] = await conn.query('INSERT INTO states (state_name) VALUES (?)', [stateName]);
      stateId = res.insertId;
      console.log('✓ state added:', stateName);
    } else {
      stateId = stateRows[0].state_id;
      console.log('  (state exists, skipping):', stateName);
    }

    for (const [districtName, cities] of districts) {
      let [distRows] = await conn.query(
        'SELECT district_id FROM districts WHERE district_name = ? AND state_id = ?',
        [districtName, stateId]
      );
      let districtId;
      if (distRows.length === 0) {
        const [res] = await conn.query(
          'INSERT INTO districts (district_name, state_id) VALUES (?, ?)',
          [districtName, stateId]
        );
        districtId = res.insertId;
        console.log('  ✓ district added:', districtName);
      } else {
        districtId = distRows[0].district_id;
      }

      for (const cityName of cities) {
        const [cityRows] = await conn.query(
          'SELECT city_id FROM cities WHERE city_name = ? AND district_id = ?',
          [cityName, districtId]
        );
        if (cityRows.length === 0) {
          await conn.query(
            'INSERT INTO cities (city_name, district_id) VALUES (?, ?)',
            [cityName, districtId]
          );
          console.log('    ✓ city added:', cityName);
        }
      }
    }
  }

  await conn.end();
  console.log('\nPan-India location seed complete!');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});