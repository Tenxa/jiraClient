if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

let port = process.env.PORT || 3003
let mongoUrl = process.env.MONGO_DB
let jiraUser = process.env.JIRA_NEW_USER
let jiraPsw = process.env.JIRA_PSW
let jiraURL = process.env.JIRA_URL
let jiraToken = process.env.JIRA_NEW_TOKEN
let jiraDevLabsUser = process.env.JIRA_DEVLABS_USER
let jiraDevLabsUrl = process.env.JIRA_DEVLABS_URL
let jiraDevLabsPsw = process.env.JIRA_DEVLABS_PSW
let jiraAsopUrl = process.env.JIRA_ASOP_URL
let devLabJql = process.DEVLABS_JQL

if (process.env.NODE_ENV === 'test') {
  port = process.env.TEST_PORT
  mongoUrl = process.env.TEST_MONGO_DB
  jiraUser = process.env.TEST_JIRA_NEW_USER
  jiraPsw = process.env.TEST_JIRA_PSW
  jiraURL = process.env.TEST_JIRA_URL
  jiraToken = process.env.TEST_JIRA_NEW_TOKEN
  jiraDevLabsUser = process.env.TEST_JIRA_DEVLABS_USER
  jiraDevLabsUrl = process.env.TEST_JIRA_DEVLABS_URL
  jiraDevLabsPsw = process.env.TEST_JIRA_DEVLABS_PSW
  jiraAsopUrl = process.env.TEST_JIRA_ASOP_URL
  devLabJql = process.TEST_DEVLABS_JQL
}

const log = (file, text) => {
  var fs = require('fs');

  var stream = fs.createWriteStream("./" + file + ".txt");
  stream.once('open', function(fd) {
    stream.write(text);
    stream.end();
  })
}


module.exports = {
  mongoUrl,
  port,
  log,
  jiraUser,
  jiraPsw,
  jiraURL,
  jiraToken,
  jiraDevLabsUser,
  jiraDevLabsUrl,
  jiraDevLabsPsw,
  jiraAsopUrl
}
