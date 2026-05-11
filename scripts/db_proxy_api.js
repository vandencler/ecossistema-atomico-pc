const express = require('express');
const bodyParser = require('body-parser');
const { pool, ecoPool } = require('../src/main/db');

const app = express();
app.use(bodyParser.json());

const API_KEY = 'EAV_SECRET_2026_RECOVERY';

app.get('/health', (req, res) => res.send('OK'));

app.post('/query', async (req, res) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).send('Unauthorized');
  }
  
  const { db, sql, params } = req.body;
  let targetPool;
  if (db === 'eco') targetPool = ecoPool;
  else if (db === 'prod') {
    const { originalPool } = require('../src/main/db');
    targetPool = originalPool;
  } else targetPool = pool;
  
  try {
    const result = await targetPool.query(sql, params);
    res.json(result.rows);
  } catch (e) {
    console.error('[PROXY ERROR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`DB Proxy API running on port ${PORT}`);
});
