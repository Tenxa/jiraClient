
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

// Later replace Jira REST API version2 calls with this. Haven't yet tested differences so let's implement later.
// const jiraClientV3 = () => {
//   const jira = new Jirajs.Version3Client({
//     host: config.jiraURL,
//     authentication: {
//       basic: {
//         email: config.jiraDevLabsUser.trim(),
//         apiToken: config.jiraToken.trim()
//       },
//     },
//   });
//   return jira
// }

const jiraTest = async () => {
  const jira = jiraClientV2()
  const jql = 'ORDER BY Created DESC'
  try {
    const issueSearch = await jira.issueSearch.searchForIssuesUsingJql(jqlSearch(0, 2, jql))
    return issueSearch
  } catch (error) {
    console.log('JiraTEst', error)
  }
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
  console.log('STARTED DB OPERATIONS')
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


const changeLogsByIdArrayV2 = async (keys) => {
  const jira = jiraClientV2()

  const results = []
  const rounds = Math.ceil(keys.length / 100)
  let index = 0
  for (let i = 0; i < rounds; i++) {
    const logsByKey = await keys.slice(index, index + 100).map(async (key) => {
      let cl = await jira.issues.getChangeLogs({ issueIdOrKey: key })

      // if logs don't fit one request. Add new values to obj keeping the first requests metadata.
      if (cl.total > 100) {
        const reqCount = Math.ceil(cl.total / 100)
        for (let j = 0; j < reqCount; j++) {
          const moreLogs = await jira.issues.getChangeLogs({ issueIdOrKey: key })
          cl.values.push(moreLogs.values)
        }
      }

      return {
        ...cl,
        issueId: key
      }
    })
    index = index + 100
    results.push(await Promise.all(logsByKey))
  }

  const updateOrInsertCLToDb = await changelogUpsert(results.flat())
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
  console.log('IN S-LOOP')
  const jira = jiraClientV2()
  let issueArray = []
  const issueSearch = await jira.issueSearch.searchForIssuesUsingJql(jqlSearch(startAt, maxResults, jql))
  issueArray.push(...issueSearch.issues)

  if (issueSearch.total > maxResults) {
    const rounds = Math.ceil(issueSearch.total / maxResults)
    //const rounds = 5
    for (i = 0; i < rounds - 1; i++) {
      startAt += maxResults
      const search = await jira.issueSearch.searchForIssuesUsingJql(jqlSearch(startAt, maxResults, jql))
      console.log(`ROUND ${i}`)
      issueArray.push(...search.issues)
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
    // Looking changes for only 3 statuses: To Do -> In Progress -> Done
    // How will we take in account the closed tickets: 'Won't do / Closed'. Keep it for Delta calculation?
    case 'status':
      const isClosed = (status) => status.split(' / ')[1] === 'Closed'

      if (changeTo === 'In Progress' || changeTo === 'In review' || changeTo === 'In testing' || changeTo === 'Live') {
        return {
          ...obj,
          status: 'In Progress',
          time
        }
      }
      if (changeTo === 'To Do' || changeTo === 'Done' || isClosed(changeTo)) {
        return {
          ...obj,
          status: changeTo,
          time
        }
      }
      return false

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

// DB upsert operation. Parses the issue id from self.url
const mapLogsWithIssueId = async () => {
  const changelogs = await mongooseQuery.changeLogs()
  return changelogs.map(async (log) => {
    const parseId = log.self ? log.self.split('issue/')[1].split('/')[0] : ''
    const logWithIssueId = {
      ...log._doc,
      issueId: parseId
    }
    //console.log(log._id)
    return await ChangeLog.findOneAndUpdate({ '_id': log._id }, logWithIssueId, { new: true, upsert: true })
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
  toDate.setUTCHours(0, 0, 0, 0)
  return toDate.toISOString()
  //return (toDate.getFullYear() + '-' + (toDate.getMonth() + 1) + '-' + toDate.getDate())
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

const createCombinationObjects = async (daysInBetween, previousTicketDate, basicTicket, map, epicOrFeature) => {
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
      // add day +1 for every new round
      newTicketTime.setDate(newTicketTime.getDate() + 1)
      if (map.get(key) === undefined || map.get(key) === false) {
        map.set(key, [newCombObj])
      } else {
        let foundIndex = foundIndexEorF(map.get(key), newCombObj, epicOrFeature)
        if (foundIndex === -1) {
          map.set(key, [...map.get(key), newCombObj])
        } else {
          map.get(key)[foundIndex].numberOfIssues += 1
        }
      }
    }
    console.log(map.size)
  } catch (error) {
    console.log(error)
  }

}

const getAllFeatureData = async () => {
  const businessProcesses = await mongooseQuery.byIssuetypeName('Business Process')

  const featureCollection = await businessProcesses.map(async (bp) => {
    const featuresForBp = await mongooseQuery.issuesByParentOrOutwardLinkId(bp.id, 'Feature')

    if (featuresForBp.length === 0) return
    const mapStoriesToFeature = await featuresForBp.map(async (feature) => {
      // could also just check stories from features inwardlinks with type.name === 'Feature link' check 
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

const getRelativeSize = (arr, issueSize) => {
  if (!arr || arr.length === 0) return 0
  const n = arr.length
  const mean = arr.reduce((a, b) => a + b) / n
  const standardDeviation = Math.sqrt(arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)

  return (issueSize - mean) / standardDeviation
}



const activePromise = async (lastYear, epicOrfeatureFlag, epicOrFeature) => {
  let cfdByDate = epicOrfeatureFlag
    ? await mongooseQuery.cfdEpicByDate(lastYear, epicOrFeature.epic)
    : await mongooseQuery.cfdFeatureByDate(lastYear, epicOrFeature.feature)
  if (cfdByDate.length === 0) {
    return true
  }
  const active = isActive(cfdByDate, epicOrFeature)
  return active
}

// Calculates the ratio of open and closed tickets (open != done, closed = done)
const calculateDelta = ({ toDo, inProgress, done }) => {
  const open = (toDo + inProgress)
  if (done === 0) return 0
  const delta = open / done
  return delta
}

// returns an array that has all the elements when numberOfIssues changes.
const getStatusIssueChanges = (statusArray) => {
  const result = new Map()
  for (let i = 0; i < statusArray.length; i++) {
    for (let j = 0; j < statusArray[i].length; j++) {
      if (j === 0) {
        result.set(statusArray[i][j].epic, [statusArray[i][j]])
      }
      const epicArray = result.get(statusArray[i][j].epic)
      if (epicArray[epicArray.length - 1].numberOfIssues !== statusArray[i][j].numberOfIssues) {
        result.get(statusArray[i][j].epic).push(statusArray[i][j])
      }
    }
  }
  return result
}

// Gets time and number of issues by looking at if next array element has increased to previous.
// Example result = [
//   { numberOfIssues: 2, time: 2022-05-11T21:00:00.000Z },
//   { numberOfIssues: 2, time: 2022-05-12T21:00:00.000Z },
//   { numberOfIssues: 1, time: 2022-05-18T21:00:00.000Z }
// ]
const getIssueStatusTimes = (arr) => {
  const res = []
  for (let i = 0; i < arr.length; i++) {
    if (i === 0) {
      res.push({ numberOfIssues: arr[i].numberOfIssues, time: arr[i].time })
    } else {
      // Will have a problem for example if we inspect from todo perspective:
      // Todo -> other (so numberOfIssues -1 in next element) and at the same time a new Todo emerges -> will not detect the new issue.
      // The problem lies in dataInit algo
      if (arr[i].numberOfIssues > arr[i - 1].numberOfIssues) {
        const resNum = arr[i].numberOfIssues - arr[i - 1].numberOfIssues
        res.push({ numberOfIssues: resNum, time: arr[i].time })
      }
    }
  }
  return res
}

const calculateMedian = (values) => {
  const sortedValues = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sortedValues.length / 2)
  return sortedValues % 2 === 0 ? (sortedValues[middle - 1] + sortedValues[middle]) / 2 : sortedValues[middle]
}

const calculateMean = (arr, simulationRounds) => {
  return arr.reduce((a, b) => a + b, 0) / simulationRounds
}

// data: Array, q: percentile of value (0.85, 0.95)
const calculatePercentile = (data, q) => {
  data = data.sort((a, b) => a - b);
  var pos = ((data.length) - 1) * q;
  var base = Math.floor(pos);
  var rest = pos - base;
  if ((data[base + 1] !== undefined)) {
    return data[base] + rest * (data[base + 1] - data[base]);
  } else {
    return data[base];
  }
}

const factTableDeviation = (arr, simulationRounds) => {
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const freqForMin = arr.filter(value => value <= min).length
  const freqForMax = arr.filter(value => value >= max).length
  const pdfForFirstRow = freqForMin / simulationRounds
  const pdfForLastRow = freqForMax / simulationRounds
  const cdfForFirstRow = pdfForFirstRow
  const cdfForLastRow = 1
  const tableArray = [{ value: min, freq: freqForMin, pdf: pdfForFirstRow, cdf: cdfForFirstRow }, { value: max, freq: freqForMax, pdf: pdfForLastRow, cdf: cdfForLastRow }]
  const copyTableArray = [...tableArray]
  copyTableArray.pop()
  let previousValue = min
  for (let i = 0; i < 9; i++) {
    const ttOrDt = previousValue + (max - min) / 10
    const frequency = arr.filter(value => value <= ttOrDt && value > previousValue).length
    // PDF -> Probability Density Function
    const pdf = frequency / simulationRounds
    // CDF -> Cumulative Distribution Function
    const cdf = copyTableArray.reduce((a, b) => a + b.freq, frequency) / simulationRounds
    tableArray.push({ value: ttOrDt, freq: frequency, pdf, cdf })
    copyTableArray.push({ value: ttOrDt, freq: frequency, pdf, cdf })
    previousValue = ttOrDt
  }
  return tableArray.sort((a, b) => a.value - b.value)
}

const factTable = (arr, propertyKey, simulationRounds) => {
  const newArr = [...arr.values()].map(element => element[propertyKey])
  const median = calculateMedian(newArr)
  const mean = calculateMean(newArr, simulationRounds)
  const standardDeviation = Math.sqrt(newArr.map((v) => Math.pow(v - mean, 2)).reduce((a, b) => a + b) / simulationRounds)
  const firstPercentile = calculatePercentile(newArr, 0.85)
  const secondPercentile = calculatePercentile(newArr, 0.95)

  return ({ median, mean, standardDeviation, "85 percentile": firstPercentile, "95 percentile": secondPercentile })
}

module.exports = {
  getIssueStatusTimes,
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
  getRelativeSize,
  activePromise,
  switchCaseStatus,
  calculateDelta,
  jiraTest,
  getStatusIssueChanges,
  factTable,
  factTableDeviation
}
