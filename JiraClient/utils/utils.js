
const JiraClient = require('jira-connector')
const jwt = require('jsonwebtoken')
const config = require('../utils/config')
const Issue = require('../models/issue')
const ChangeLog = require('../models/changeLog')

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

//const getTokenFrom = (request) => {
//
//  try {
//    const authorization = request.get('Authorization')
//    console.log('authorization', authorization)
//    if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
//      console.log('index to subst', authorization.lastIndexOf('bearer ') + 7)
//      return authorization.substring(authorization.lastIndexOf('bearer ') + 7)
//    }
//    return null
//  }
//  catch (e)  {
//    console.log(e)
//  }
//}

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

const removeObjId = (obj) => {
  let { ...a } = obj
  let { _id, ...doc } = a._doc
  //console.log(doc)
  return doc
}

const compareChangeLogs = (obj1, obj2) => {
  if (obj1.self === obj2.self) {
    return true
  }
  if (obj1.total === obj2.total) {
    return true
  }
  return false
}

// Currently not in use but keeping in case
const createNewIssue = (issue) => {
  let field = { ...issue.fields }
  let newIssue = {
    ...issue,
    issueId: issue.id,
    fields: {
      ...field,
      issuetype: {
        ...field.issuetype,
        issueTypeId: field.issuetype.id,
      },
      project: {
        ...field.project,
        projectId: field.project.id
      },
      priority: {
        ...field.priority,
        priorityId: field.priority.id
      },
      status: {
        ...field.status,
        statusId: field.status.id,
        statusCategory: {
          ...field.status.statusCategory,
          statusCategoryId: field.status.statusCategory.id
        }
      }
    }
  }
  return newIssue
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

const changelogsByIdArray = async (array) => {
  const jira = createJiraClientWithToken()
  const clogsById = array.map(async (id) => {
    // Voidaanko tässä hakea createdin mukaan?, jos ei muuta niin filtteröidään resulttia.
    const cl = await jira.issue.getChangelog({
      issueId: id
    })
    const newCl = {
      ...cl,
      issueId: id
    }
    return newCl
  })
  const results = await Promise.all(clogsById)
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
  changelogsByIdArray,
  issueSearchLoop
}
