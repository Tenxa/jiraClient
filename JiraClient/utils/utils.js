
const JiraClient = require('jira-connector')
const jwt = require('jsonwebtoken')
const config = require('../utils/config')
const Issue = require('../models/issue')
const ChangeLog = require('../models/changeLog')
const Jirajs = require('jira.js')


const createJiraToken = () => {
  //console.log(config.jiraUser + ':' + config.jiraToken);
  //console.log('Basic ' + Buffer.from(config.jiraUser + ':' + config.jiraToken).toString('base64'));
  return Buffer.from(config.jiraUser + ':' + config.jiraToken).toString('base64')
  //return 'Basic ' + config.jiraUser + ':' + config.jiraPsw
}

const createJiraTokenFromPsw = () => {
  console.log(config.jiraDevLabsUser + ':' + config.jiraDevLabsPsw);
  console.log('Basic ' + Buffer.from(config.jiraDevLabsUser + ':' + config.jiraDevLabsPsw).toString('base64'));
  return Buffer.from(config.jiraDevLabsUser + ':' + config.jiraDevLabsPsw).toString('base64')
  //return 'Basic ' + config.jiraUser + ':' + config.jiraPsw
}

const createJiraClientWithToken = () => {
  const jira = new JiraClient({
    host: config.jiraURL,
    basic_auth: {
      base64: createJiraToken()
    }
  })
  return jira
}

const createJiraClientWithMailAndToken = () => {
  const jira = new JiraClient({
    host: config.jiraURL,
    basic_auth: {
      email: config.jiraDevLabsUser.trim(),
      api_token: config.jiraToken.trim()
    },
    strictSSL: false,
    apiVersion: '2',
  })
  return jira
}

const jiraClientV2 = () => {
  const jira = new Jirajs.Version2Client({
    host: config.jiraURL,
    authentication: {
      basic: {
        email: config.jiraDevLabsUser.trim(),
        apiToken: config.jiraToken.trim()
      },
    },
  });
  return jira
}


const isValidCall = (request) => {
  try {
    const body = request.body

    //const token = getTokenFrom(request)
    const token = request.headers.authorization.split(' ')[1]
    let decodedToken = undefined
    if (token) {
      decodedToken = jwt.verify(token, process.env.SECRET)
    }


    if (!token || !decodedToken.id) {
      return { 'statuscode': 401, 'status': 'token missing or invalid' }
    }

    if (body === undefined) {
      return { 'statuscode': 400, 'status': 'content missing' }
    }
    else {
      return { 'statuscode': 200, 'status': 'OK', 'id': decodedToken.id }
    }
  }
  catch (e) {
    console.log(e)
    return { 'statuscode': 500, 'status': 'epicFail' }
  }
}


// Kahdesta alla olevista funktioista voisi tehdä geneerisempi toteutus...
const issuePromises = (issues) => {
  return issues.map((async i => {
    return Issue.findOneAndUpdate({ 'id': i.id }, i, { new: true, upsert: true })
      .then(updatedIssue => updatedIssue)
      .catch(error => {
        console.log(error)
        return error
      })
  }))
}

const changelogUpsert = (issues) => {
  return issues.map((async i => {
    return ChangeLog.findOneAndUpdate({ 'issueId': i.issueId }, i, { new: true, upsert: true })
      .then(updatedIssue => updatedIssue)
      .catch(error => {
        console.log(error)
        return error
      })
  }))

}

const jqlSearch = (start, max, jql) => {
  return {
    //jql: 'ORDER BY Created DESC',
    jql,
    maxResults: max,
    startAt: start
  }
}

const changeLogsByIdArrayV2 = async (ids) => {
  const jira = jiraClientV2()

  const logsById = ids.map(async (id) => {
    const cl = await jira.issues.getChangeLogs({
      issueIdOrKey: id
    })
    return {
      ...cl,
      issueId: id
    }
  })

  const results = await Promise.all(logsById)
  const updateOrInsertCLToDb = await changelogUpsert(results)
  return await Promise.all(updateOrInsertCLToDb)
}


const issueSearchLoop = async (startAt, maxResults, jql) => {
  const jira = createJiraClientWithToken()
  let issueArray = []
  const issueSearch = await jira.search.search(jqlSearch(startAt, maxResults, jql))
  issueSearch.issues.map(i => {
    issueArray.push(i)
  })
  if (issueSearch.total > maxResults) {
    const rounds = Math.ceil(issueSearch.total / maxResults)
    for (i = 0; i < rounds - 1; i++) {
      startAt += maxResults
      const search = await jira.search.search(jqlSearch(startAt, maxResults, jql))
      search.issues.map(i => {
        issueArray.push(i)
      })
    }
  }
  const updateOrInsertIssueToDb = await issuePromises(issueArray)
  return await Promise.all(updateOrInsertIssueToDb)
}


module.exports = {
  isValidCall,
  createJiraToken,
  createJiraTokenFromPsw,
  createJiraClientWithToken,
  createJiraClientWithMailAndToken,
  changelogUpsert,
  issueSearchLoop,
  jiraClientV2,
  changeLogsByIdArrayV2
}
