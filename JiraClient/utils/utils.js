
const JiraClient = require('jira-connector')
const jwt = require('jsonwebtoken')
const config = require('../utils/config')
const ChangeLog = require('../models/changeLog')
const Jirajs = require('jira.js')
const Ticket = require('../models/ticket')


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

const jiraAgileClient = () => {
  const agile = new Jirajs.AgileClient({
    host: config.jiraURL,
    authentication: {
      basic: {
        email: config.jiraDevLabsUser.trim(),
        apiToken: config.jiraToken.trim()
      },
    },
  })
  return agile
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
    return Ticket.findOneAndUpdate({ 'id': i.id }, i, { new: true, upsert: true })
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
    startAt: start,
    expand: ['changelog']
  }
}

const changeLogsByIdArrayV2 = async (ids, db) => {
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
  if (!db) {
    console.log('NO DB')
    return results
  }

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

const switchCaseStatus = (key, { toDo, inProgress, done } = { toDo: 0, inProgress: 0, done: 0 }) => {
  switch (key) {
    case 'To Do':
      toDo += 1
      break;
    case 'In Progress':
      inProgress += 1
      break;
    case 'Done':
      done += 1
      break;
    default:
      break;
  }
  return {
    toDo,
    inProgress,
    done
  }
}

const issueSearchLoopNoDB = async (startAt, maxResults, jql) => {
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
  return issueArray
}


const issueSearchLoopJiraV2 = async (startAt, maxResults, jql) => {
  const jira = jiraClientV2()
  let issueArray = []
  const issueSearch = await jira.issueSearch.searchForIssuesUsingJql(jqlSearch(startAt, maxResults, jql))
  issueSearch.issues.map(i => {
    issueArray.push(i)
  })
  if (issueSearch.total > maxResults) {
    const rounds = Math.ceil(issueSearch.total / maxResults)
    for (i = 0; i < rounds - 1; i++) {
      startAt += maxResults
      const search = await jira.issueSearch.searchForIssuesUsingJql(jqlSearch(startAt, maxResults, jql))
      search.issues.map(i => {
        issueArray.push(i)
      })
    }
  }
  return issueArray
}

const isPertientChange = (key, obj, changeTo, time) => {
  switch (key) {
    case 'Parent':
      return {
        ...obj,
        epic: changeTo,
        time
      }
    case 'IssueParentAssociation':
      return {
        ...obj,
        epic: changeTo,
        time
      }
    case 'status':
      return {
        ...obj,
        status: changeTo,
        time
      }
    case 'project':
      return {
        ...obj,
        project: changeTo,
        time
      }
    case 'issuetype':
      return {
        ...obj,
        issuetype: changeTo,
        time
      }
    default:
      return false
  }
}


const getAllProjects = async () => {
  const jira = jiraClientV2()

  const projects = await jira.projects.getAllProjects({
    expand: ['issueTypes', 'projectKeys', 'insight']
  })
  return projects
}

// DB upsert operation. Parses the issue id from self url
const mapLogsWithIssueId = async () => {
  const changelogs = await mongooseQuery.changeLogs()
  changelogs.map((log) => {
    const parseId = log.self ? log.self.split('issue/')[1].split('/')[0] : ''
    const logWithIssueId = {
      ...log._doc,
      issueId: parseId
    }
    console.log(log.self)
    return ChangeLog.findOneAndUpdate({ '_id': log._id }, logWithIssueId, { new: true, upsert: true })
  })
}

const getDaysBetweenDates = (date1, date2) => {
  const time1 = new Date(date1)
  const time2 = new Date(date2)
  const diffInMillis = time1 - time2
  const days = Math.ceil(diffInMillis / (1000 * 3600 * 24))
  return days
}

const parseDateyyyymmdd = (date) => {
  const toDate = new Date(date)
  return (toDate.getFullYear() + '-' + (toDate.getMonth() + 1) + '-' + toDate.getDate())
}

const createCombinationObjects = (daysInBetween, previousTicketDate, basicTicket, array) => {
  let newTicketTime = new Date(previousTicketDate)
  for (let i = 0; i < daysInBetween; i++) {
    const newCombObj = {
      ...basicTicket,
      time: parseDateyyyymmdd(newTicketTime),
    }
    newTicketTime.setDate(newTicketTime.getDate() + 1)
    array.push(newCombObj)
  }
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
  jiraAgileClient,
  changeLogsByIdArrayV2,
  switchCaseStatus,
  issueSearchLoopNoDB,
  issueSearchLoopJiraV2,
  isPertientChange,
  getAllProjects,
  issuePromises,
  mapLogsWithIssueId,
  getDaysBetweenDates,
  parseDateyyyymmdd,
  createCombinationObjects
}
