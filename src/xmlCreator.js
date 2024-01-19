/* eslint-disable no-undef */
const axios = require("axios");
const fs = require("fs");

async function retrieveXML() {
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

  return response.data;
}

async function writeXMLExportFile() {
  const xml = await retrieveXML();

  fs.writeFileSync("export.xml", xml);
}

exports.writeXMLExportFile = writeXMLExportFile;
