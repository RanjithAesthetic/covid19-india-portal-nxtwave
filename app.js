const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const databasePath = path.join(__dirname, "covid19IndiaPortal.db");
let database = null;

const initializeDBAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at htttp://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const convertStateObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.header["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username= '${username}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

app.get("/states/", authenticationToken, async (request, response) => {
  const getStateQuery = `SELECT * FROM state;`;
  const statesArray = await database.all(getStateQuery);
  response.send(
    statesArray.map((eachState) =>
      convertStateObjectToResponseObject(eachState)
    )
  );
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id =${stateId};`;
  const state = await database.get(getStateQuery);
  response.send(convertStateObjectToResponseObject(state));
});

app.get(
  "/district/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id =${districtId};`;
    const district = await database.get(getDistrictQuery);
    response.send(convertDistrictObjectToResponseObject(district));
  }
);

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) VALUES ('${districtName}',${stateId},'${cases}','${active}','${deaths}','${cured}');`;
  await database.run(postDistrictQuery);
  response.send("District Successfully Added");
});

app.delete(
  "/district/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id =${districtId};`;
    await database.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district  SET district_name = '${districtName}',state_id = ${stateId},cases = '${cases}',cured = '${cured}',active = '${active}',deaths = '${deaths}' WHERE district_id = ${districtId} ;`;
    await database.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `SELECT SUM(cases),SUM(cured), SUM(active), SUM(deaths) FROM district  WHERE state_id = ${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCures: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
