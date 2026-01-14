const { poolPromise, sql } = require("../config/db");

// Query function
async function queryDB(query, params = {}) {
  const pool = await poolPromise;
  const request = pool.request();

  for (const key in params) {
    request.input(key, params[key]);
  }

  return request.query(query);
}




module.exports = { queryDB, sql };
