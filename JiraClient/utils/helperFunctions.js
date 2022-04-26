
const JiraClient = require('jira-connector')
const jwt = require('jsonwebtoken')
const config = require('./config')
const ChangeLog = require('../models/changeLog')
const Jirajs = require('jira.js')
const Ticket = require('../models/ticket')
const Cfd = require('../models/cfdTable')
const async = require('async')
const mongooseQuery = require('./mongooseQueries')


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

// loops through array and will increment numberOfIssues by 1
const cfdEpicUpsert = async (array) => {
  async.eachSeries(array, (obj, done) => {
    Cfd.findOneAndUpdate({
      'theme': obj.theme,
      'epic': obj.epic,
      'project': obj.project,
      'time': obj.time,
      'issuetype': obj.issuetype,
      'status': obj.status
    }, { $inc: { numberOfIssues: 1 } }, { new: true, upsert: true }, done)
  }, (error) => {
    if (error) {
      console.log(error)
    } else {
      console.log('done')
    }
  })
}

// loops through array and will increment numberOfIssues by 1
const cfdFeatureUpsert = async (array) => {
  async.eachSeries(array, (obj, done) => {
    Cfd.findOneAndUpdate({
      'businessProcess': obj.businessProcess,
      'feature': obj.feature,
      'project': obj.project,
      'time': obj.time,
      'issuetype': obj.issuetype,
      'status': obj.status
    }, { $inc: { numberOfIssues: 1 } }, { new: true, upsert: true }, done)
  }, (error) => {
    if (error) {
      console.log(error)
    } else {
      console.log('done')
    }
  })
}




const jqlSearch = (start, max, jql) => {
  return {
    //jql: 'ORDER BY Created DESC',
    jql,
    maxResults: max,
    startAt: start,
    //expand: ['changelog']
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

const isPertientChangeFeature = (key, obj, changeTo, time) => {
  switch (key) {
    case 'Link':
      if (changeTo === null || changeTo === undefined) return false
      if (changeTo.includes('This issue belongs to Feature')) {
        return {
          ...obj,
          feature: changeTo.split('Feature ')[1].trim(),
          time
        }
      } else {
        return false
      }
    case 'IssueParentAssociation':
      return {
        ...obj,
        feature: changeTo,
        time
      }
    case 'status':
      if (changeTo !== 'To Do' || changeTo !== 'In Progress' || changeTo !== 'Done') return false
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

const isPertientChangeEpic = (key, obj, changeTo, time) => {
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

// true => epic, false => feature
const foundIndexEorF = (array, newCombObj, epicOrFeature) => {
  const found = epicOrFeature ?
    array.findIndex(e => {
      return (
        e.businessProcess === newCombObj.businessProcess &&
        e.epic === newCombObj.epic &&
        e.project === newCombObj.project &&
        e.time === newCombObj.time &&
        e.issuetype === newCombObj.issuetype &&
        e.status === newCombObj.status)
    })
    : array.findIndex(e => {
      return (
        e.businessProcess === newCombObj.businessProcess &&
        e.feature === newCombObj.feature &&
        e.project === newCombObj.project &&
        e.time === newCombObj.time &&
        e.issuetype === newCombObj.issuetype &&
        e.status === newCombObj.status)
    })
    return found
}

const createCombinationObjects = async (daysInBetween, previousTicketDate, basicTicket, array, epicOrFeature) => {
  try {
    if (basicTicket.feature === null || basicTicket === null || basicTicket.epic === null) return
    let newTicketTime = new Date(previousTicketDate)
    let today = parseDateyyyymmdd(new Date())
    let key = basicTicket.feature ? basicTicket.feature : basicTicket.epic
    const { issueId, ...basicData } = basicTicket

    for (let i = 0; i < daysInBetween; i++) {
      const newCombObj = {
        ...basicData,
        numberOfIssues: 1,
        time: parseDateyyyymmdd(newTicketTime),
        configurationDate: today
      }
      newTicketTime.setDate(newTicketTime.getDate() + 1)
      if (array.get(key) === undefined || array.get(key) === false) {
        array.set(key, [newCombObj])
      } else {
        let foundIndex = foundIndexEorF(array.get(key), newCombObj, epicOrFeature)
        if (foundIndex === -1) {
          array.set(key, [...array.get(key), newCombObj])
        } else {
          array.get(key)[foundIndex].numberOfIssues += 1
        }
      }
    }
    console.log(array.size)
  } catch (error) {
    console.log(error)
  }

}

const getAllFeatureData = async () => {
  const businessProcesses = await mongooseQuery.byIssuetypeName('Business Process')

  const featureCollection = businessProcesses.map(async (bp) => {
    const featuresForBp = await mongooseQuery.issuesByParentOrOutwardLinkId(bp.id, 'Feature')

    if (featuresForBp.length === 0) return
    const mapStoriesToFeature = await featuresForBp.map(async (feature) => {
      // could also just check stories from features inwardlinks with type.name === "Feature link" check 
      const storiesForFeature = await mongooseQuery.issuesByParentOrOutwardLinkId(feature.id, 'Story')
      let storyStatusesCount = {
        toDo: 0,
        inProgress: 0,
        done: 0
      }
      const storiesForFeatureBasic = await storiesForFeature.map(story => {
        const featureLinkFilter = story.fields.issuelinks.filter(link => link.type.name === 'Feature link')
          .filter(link => link.hasOwnProperty('outwardIssue'))
          .filter(link => link.outwardIssue.key === feature.key)

        if (featureLinkFilter.length === 0) {
          return
        }
        storyStatusesCount = switchCaseStatus(story.fields.status.statusCategory.name, storyStatusesCount)
        return {
          businessProcess: bp.key,
          feature: feature.key,
          issueId: story.id,
          key: story.key,
          issuetype: story.fields.issuetype.name,
          status: story.fields.status.statusCategory.name,
          project: story.fields.project.key,
          time: story.fields.created
        }
      })
      return {
        featureName: feature.key,
        toWhichBusinessProcess: bp.key,
        storyStatusesCount,
        storiesForFeatureBasic
      }
    })

    const featuresData = await Promise.all(mapStoriesToFeature)
    return featuresData
  })
  return featureCollection
}

// epicOrFeature = true => epic,
// epicOrFeature = false => feature,
const countStatuses = (arr, epicOrFeatureName, themeOrBpName, epicOrFeature) => {
  let storyStatusesCount = {
    toDo: 0,
    inProgress: 0,
    done: 0
  }
  arr.forEach(element => {
    storyStatusesCount = switchCaseStatus(element.fields.status.statusCategory.name, storyStatusesCount)
  })
  return epicOrFeature ?
    {
      epicName: epicOrFeatureName,
      toWhichTheme: themeOrBpName,
      storyCount: arr.length,
      storyStatusesCount,
    } :
    {
      featureName: epicOrFeatureName,
      toWhichBusinessProcess: themeOrBpName,
      storyCount: arr.length,
      storyStatusesCount,
    }
}

/* 
  Currently will ignore cases if tickets change statuses vice versa
  Will need a complete cfd collection to work properly
*/
const isActive = (arr, feature) => {
  const shallowEqual = (object1, object2) => {
    const keys1 = Object.keys(object1)
    const keys2 = Object.keys(object2)
    if (keys1.length !== keys2.length) {
      return false
    }
    for (let key of keys1) {
      if (object1[key] !== object2[key]) {
        return false
      }
    }
    return true
  }

  const statuses = { toDo: 0, inProgress: 0, done: 0 }
  arr.forEach((element) => {
    switch (element.status) {
      case 'To Do':
        return statuses.toDo += 1
      case 'In Progress':
        return statuses.inprogress += 1
      case 'Done':
        return statuses.done += 1
    }
  })

  return !shallowEqual(statuses, feature.storyStatusesCount)
}

const getStandardDeviation = (arr) => {
  const n = arr.length
  const mean = arr.reduce((a, b) => a + b) / n
  if (!arr || arr.length === 0) return 0
  return Math.sqrt(arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}

const activePromise = async (lastYear, f) => {
  let cfdByDate = await mongooseQuery.cfdFeatureByDate(lastYear, f.feature)
  if (cfdByDate.length === 0) {
    return true
  }
  const active = isActive(cfdByDate, f)
  return active
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
  issueSearchLoopNoDB,
  issueSearchLoopJiraV2,
  isPertientChangeEpic,
  isPertientChangeFeature,
  getAllProjects,
  issuePromises,
  mapLogsWithIssueId,
  getDaysBetweenDates,
  parseDateyyyymmdd,
  createCombinationObjects,
  cfdEpicUpsert,
  cfdFeatureUpsert,
  getAllFeatureData,
  countStatuses,
  isActive,
  getStandardDeviation,
  activePromise,
  switchCaseStatus
}
