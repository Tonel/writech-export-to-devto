/* eslint-disable no-undef */
const axios = require("axios");
const fs = require("fs");

async function retrieveXML() {
  console.log("Retrieving the export.xml file from writech.run...");
  const response = await axios.post(
    process.env.EXPORT_API,
    {},
    {
      auth: {
        username: process.env.BASIC_AUTH_USERNAME,
        password: process.env.BASIC_AUTH_PASSWORD,
      },
    }
  );

  console.log("export.xml retrieved!");

  return response.data;
}

async function writeXMLExportFile() {
  const xml = await retrieveXML();

  console.log("Writing export.xml to a local file...");

  fs.writeFileSync("export.xml", xml);

  console.log("export.xml written!\n");
}

exports.writeXMLExportFile = writeXMLExportFile;
