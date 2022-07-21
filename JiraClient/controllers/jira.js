const jiraRouter = require('express').Router()
const utils = require('../utils')
const Ticket = require('../models/ticket')
const Feature = require('../models/feature')
const Epic = require('../models/epic')
const middleware = require('../utils/middleware')
require('express-async-errors')



// Nyt haetaan tietokannasta tickets collectionista.
// Myöhemmin, joko tallennetaan kaikki ticketit tietokantaan ja nykyinen toteutus käy hakemassa sieltä,
// Tai haemme jira API:lla tämän funktion alussa.
jiraRouter.get('/dataInit', async (request, response) => {
  try {
    const featuresData = await utils.helpers.getAllFeatureData()
    const resolveData = await Promise.all(featuresData)
    const filterUndefinedFeatures = await resolveData.flat().filter(a => a !== undefined)
      .filter(s => s.storiesForFeatureBasic.length > 0)

    const resultFeature = await utils.dataInitLoop.dataInitLoop(filterUndefinedFeatures, false)

    const themeEpic = await utils.storiesWithThemaAndEpic.storiesWithThemaAndEpic()
    const resultEpic = await utils.dataInitLoop.dataInitLoop(themeEpic, true)

    const epicAndFeatureResult = resultFeature.concat(resultEpic)
    await utils.mongooseQueries.insertCfds(epicAndFeatureResult)
    response.json(resultFeature.length + resultEpic.length)
  } catch (error) {
    console.log(error)
  }
})

jiraRouter.get('/cfdByDateRange', async (request, response) => {
  try {
    const date1 = request.query.from
    const date2 = request.query.to
    const cfds = await utils.mongooseQueries.cfdsInRange(date1, date2)
    const sortByDate = cfds.sort((a, b) => {
      return new Date(a.time) - new Date(b.time)
    })
    response.json(sortByDate)
  } catch (error) {
    console.log(error)
    response.status(404).end('Error')
  }
})

jiraRouter.get('/cfdByDateRangeEpic', async (request, response) => {
  try {
    const date1 = request.query.from
    const date2 = request.query.to
    const cfds = await utils.mongooseQueries.epicCfdsInRange(date1, date2)
    const sortByDate = cfds.sort((a, b) => {
      return new Date(a.time) - new Date(b.time)
    })
    response.json(sortByDate)
  } catch (error) {
    console.log(error)
    response.status(404).end('Error')
  }
})

jiraRouter.get('/cfdByDateRangeFeature', async (request, response) => {
  try {
    const date1 = request.query.from
    const date2 = request.query.to
    const cfds = await utils.mongooseQueries.featureCfdsInRange(date1, date2)
    const sortByDate = cfds.sort((a, b) => {
      return new Date(a.time) - new Date(b.time)
    })
    response.json(sortByDate)
  } catch (error) {
    console.log(error)
    response.status(404).end('Error')
  }
})

jiraRouter.get('/cfdEpicByKey/:key', async (request, response) => {
  try {
    const epic = await utils.mongooseQueries.cfdByEpic(request.params.key)
    const epicsSortedByDate = epic.sort((a, b) => {
      return new Date(a.time) - new Date(b.time)
    })
    response.json(epicsSortedByDate)
  } catch (error) {
    response(404).end('Error')
  }
})

jiraRouter.get('/cfdFeatureByKey/:key', async (request, response) => {
  try {
    const feature = await utils.mongooseQueries.cfdByFeature(request.params.key)
    const featuresSortedByDate = feature.sort((a, b) => {
      return new Date(a.time) - new Date(b.time)
    })
    response.json(featuresSortedByDate)
  } catch (error) {
    response(404).end('Error')
  }
})


// Used when data is imported from a file.
// parses issue key from self field.
jiraRouter.get('/issueIdToChangelogs', async (request, response) => {
  try {
    const parseIssueIds = await utils.helpers.mapLogsWithIssueId()
    const resolved = await Promise.all(parseIssueIds)
    response.status(200).send('Success')
  } catch (error) {
    console.log(error)
    response.status(404).end('Error')
  }
})


// Inserts feature data based on tickets collection in db.
// Currently we don't have a complete cfd collection, so the active field is not showing 
//   its real value.
jiraRouter.get('/insertFeatures', async (request, response) => {
  try {
    await Feature.collection.drop()
  } catch (error) {
    if (error.code === 26) {
      console.log('namespace not found')
    } else {
      throw error;
    }
  }

  const featureCollection = await utils.helpers.getAllFeatureData()
  const resolveArray = await Promise.all(featureCollection)
  const filterUndefined = await resolveArray.flat().filter(a => a !== undefined)

  // returns an array for all of the features numberOfIssues
  const statusCounts = filterUndefined.map(f => {
    return f.storyStatusesCount.toDo + f.storyStatusesCount.inProgress + f.storyStatusesCount.done
  })

  const lastYear = new Date()
  lastYear.setFullYear(lastYear.getFullYear() - 1)
  const featurePromises = filterUndefined.map(async (f) => {
    const active = await utils.helpers.activePromise(lastYear, false, f)
    // Max value to 3?
    const issueSize = f.storyStatusesCount.toDo + f.storyStatusesCount.inProgress + f.storyStatusesCount.done
    const relativeSize = utils.helpers.getRelativeSize(statusCounts, issueSize)

    return {
      feature: f.featureName,
      businessProcess: f.toWhichBusinessProcess,
      storyStatusesCount: f.storyStatusesCount,
      relativeSize,
      active
    }
  })
  const resolvedPromises = await Promise.all(featurePromises)
  await utils.mongooseQueries.insertFeatures(resolvedPromises)

  response.json(resolvedPromises)
})



jiraRouter.get('/insertEpics', async (request, response) => {
  try {
    await Epic.collection.drop()
  } catch (error) {
    if (error.code === 26) {
      console.log('namespace not found')
    } else {
      throw error;
    }
  }

  const lastYear = new Date()
  lastYear.setFullYear(lastYear.getFullYear() - 1)

  const themeEpic = await utils.storiesWithThemaAndEpic.storiesWithThemaAndEpic()

  const statusCounts = themeEpic.map(e => {
    return e.storyStatusesCount.toDo + e.storyStatusesCount.inProgress + e.storyStatusesCount.done
  })

  const epicPromises = themeEpic.map(async (e) => {
    const active = await utils.helpers.activePromise(lastYear, true, e)
    const issueSize = e.storyStatusesCount.toDo + e.storyStatusesCount.inProgress + e.storyStatusesCount.done
    const relativeSize = utils.helpers.getRelativeSize(statusCounts, issueSize)
    const delta = await utils.helpers.calculateDelta(e.storyStatusesCount)
    return {
      epic: e.epic,
      theme: e.theme,
      storyStatusesCount: e.storyStatusesCount,
      relativeSize,
      active,
      delta
    }
  })

  const resolvedPromises = await Promise.all(epicPromises)
  await utils.mongooseQueries.insertEpics(resolvedPromises)
  response.json(resolvedPromises)
})

/* 
  Returns feature from db that simulates the fetch from jira (the most recent state)
  And compares to the tickets state at configured date or a year ago.
  Currently we don't have a complete cfd collection, so the active field is not showing 
  its real value.
*/
jiraRouter.get('/featureTable', async (request, response) => {
  // date can be passed in format yyyy-mm-dd
  const configuredDate = request.body.configuredDate ? request.body.configuredDate : null
  //Get all features from feature collection
  const allFeatures = await utils.mongooseQueries.getFeaturesFromDB()

  const mapDataToFeatures = allFeatures.map(async (f) => {
    if (!configuredDate) {
      return await utils.mongooseQueries.getFeatureByKeyFromDB(f.feature)
    }
    const cfdByDate = await utils.mongooseQueries.cfdFeatureByDate(configuredDate, f.feature)
    const active = await utils.helpers.isActive(cfdByDate, f)

    return {
      businessProcess: f.businessProcess,
      feature: f.feature,
      storyStatusesCount: f.storyStatusesCount,
      relativeSize: f.relativeSize,
      active,
    }
  })
  const resolvedPromises = await Promise.all(mapDataToFeatures)
  response.json(resolvedPromises.flat())
})



// Material for Monte Carlo Simulation: 
// https://www.slideshare.net/dimiterbak/noestimates-project-planning-using-monte-carlo-simulation
// https://www.youtube.com/watch?v=r38a25ak4co&t=2194s

// Monte Carlo Simulation:
// This will now do a monte carlo for N work items.
// For us to make a forecast on a started Epic we would have to create SIP files for the 3 different phases of Z-Curve
// and do a Monte Carlo simulation for the wanted Z-curve phases.
jiraRouter.get('/monteCarlo', async (request, response) => {
  const sip = await utils.createSip.createSip()
  const epicSize = 20
  const simulationRounds = 1000
  const randomElement = () => {
    return sip[Math.floor(Math.random() * sip.length)]
  }
  const results = new Map()

  // results: 
  // 1 => { deliveryTime: 572, averageTaktTime: 28.6 },
  // 2 => { deliveryTime: 776, averageTaktTime: 38.8 },
  // 3 => { deliveryTime: 1119, averageTaktTime: 55.95 },
  // 4 => { deliveryTime: 731, averageTaktTime: 36.55 }, ....
  for (let i = 0; i < simulationRounds; i++) {
    const resampledArray = []
    for (let j = 0; j < epicSize; j++) {
      resampledArray.push(randomElement())
    }

    const deliveryTime = resampledArray.reduce((previous, current) => previous + current, 0)
    const averageTaktTime = deliveryTime / resampledArray.length
    results.set(i + 1, { deliveryTime, averageTaktTime })
  }

  const ttArray = [...results.values()].map(v => v.averageTaktTime)
  const dtArray = [...results.values()].map(v => v.deliveryTime)


  //console.log(simulationRounds)
  // Function can be used in response etc to round values.
  // const round2Decimals = Math.round((ttOrDt + Number.EPSILON) * 100) / 100 factTable([...results.values()], "averageTaktTime"),

  response.json({
    DeviationTableTT: utils.helpers.factTableDeviation(ttArray, simulationRounds), FactTableTT: utils.helpers.factTable([...results.values()], "averageTaktTime", simulationRounds),
    DeviationTableT: utils.helpers.factTableDeviation(dtArray, simulationRounds), FactTableT: utils.helpers.factTable([...results.values()], "deliveryTime", simulationRounds)
  })
  //response.json(factTableDeviation(ttArray))
  //response.json([...results.entries()])
})


// Create a SIP (Stochastic Information Packet) from historical data.
// Thoughts: 
// - Create a SIP packet from all ticket Takt Times (Ticket Delivery time)
//    - Could be created in the initialization phase and added to database.
// - 

// TODO: Parallelly done tickets
jiraRouter.get('/createSip', async (request, response) => {
  // Check Time between in progress -> done OR To Do -> Done but time = 0 in the latter case.
  const epics = await utils.storiesWithThemaAndEpic.storiesWithThemaAndEpic()
  const epicsWithIssues = epics.filter(epic => epic.stories.length > 0)

  const mapStories = epicsWithIssues.map(async (epic) => {
    const cfdsForEpic = await utils.mongooseQueries.cfdByEpic(epic.epic)
    return [...cfdsForEpic]
  })

  const resolveCfds = await Promise.all(mapStories)
  const filterEmpties = resolveCfds.filter(cfds => cfds.length > 0)
  const sortByDate = filterEmpties.map(epic => epic.sort((a, b) => a.time - b.time))


  // inProgchanges is a Map with epic as key and array of changes in numberOfIssues as value. 
  const inProgChanges = utils.helpers.getStatusIssueChanges(sortByDate.map(epic => epic.filter(cfd => cfd.status === 'In Progress')))
  const doneChanges = utils.helpers.getStatusIssueChanges(sortByDate.map(epic => epic.filter(cfd => cfd.status === 'Done')))
  const todoChanges = utils.helpers.getStatusIssueChanges(sortByDate.map(epic => epic.filter(cfd => cfd.status === 'To Do')))


  const taktTimes = []
  for (const key of doneChanges.keys()) {
    let dones = utils.helpers.getIssueStatusTimes(doneChanges.get(key))
    let inProgs = utils.helpers.getIssueStatusTimes(inProgChanges.get(key))
    let todos = utils.helpers.getIssueStatusTimes(todoChanges.get(key))

    if (dones === undefined || inProgs === undefined || todos === undefined) continue

    // TODO: How to take in consideration tickets that are made in parallel.
    // Notes: tickets are sorted by date (start) at this point, so we'll inspect the previous ticket and see if the current ticket is done on the same day as the previous.
    //        There is uncertainty in our approach as we dont track an individual tickets status process. Just looking kind of randomly at status changes and their dates.
    //        The most simple situation is when ticket has same "start" and Done date.
    for (let i = 0; i < dones.length; i++) {
      for (let j = 0; j < dones[i].numberOfIssues; j++) {
        // if done.time is earlier than the next inProg then it has to be taken from done -> todo. Same if inProgs are empty.
        // if both todo and inProgress are in the future then taktTime for the ticket = 0
        if (todos.length > 0 && (inProgs.length == 0 || inProgs[0].time > dones[i].time)) {
          console.log(todos[0].time > dones[i].time)
          if (todos[0].time > dones[i].time) {
            taktTimes.push(0)
          } else {
            taktTimes.push(utils.helpers.getDaysBetweenDates(dones[i].time, todos[0].time))
          }
        } else {
          taktTimes.push(utils.helpers.getDaysBetweenDates(dones[i].time, inProgs[0].time))
          inProgs[0].numberOfIssues--
        }

        if (todos.length > 0 && todos[0].time < dones[i].time) {
          todos[0].numberOfIssues--
          if (todos[0].numberOfIssues === 0) { todos.shift() }
        }
        if (inProgs.length > 0) {
          if (inProgs[0].numberOfIssues === 0) { inProgs.shift() }
        }
      }
    }
  }

  response.json({ taktTimes })
  //response.json({ testTodos, testInprog, testDones })
  //response.json({ inProgress: Array.from(inProgChanges.entries()), dones: Array.from(doneChanges.entries()) })
})



jiraRouter.get('/test', async (request, response) => {
  function ncdf(x, mean, std) {
    var x = (x - mean) / std
    var t = 1 / (1 + .2315419 * Math.abs(x))
    var d = .3989423 * Math.exp(-x * x / 2)
    var prob = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    if (x > 0) prob = 1 - prob
    return prob
  }
  response.json({ inProg, dones })
})



jiraRouter.get('/epicsTable', async (request, response) => {
  const configuredDate = request.body.configuredDate ? request.body.configuredDate : null

  // From Epic-collection
  const allEpics = await utils.mongooseQueries.getEpicsFromDB()

  const mapDataToEpics = allEpics.map(async (e) => {
    if (!configuredDate) {
      return await utils.mongooseQueries.getEpicByKeyFromDB(e.epic)
    }
    const cfdByDate = await utils.mongooseQueries.cfdEpicByDate(configuredDate, e.epic)
    const active = await utils.helpers.isActive(cfdByDate, e)
    const delta = await utils.helpers.calculateDelta(e.storyStatusesCount)

    return {
      theme: e.theme,
      epic: e.epic,
      storyStatusesCount: e.storyStatusesCount,
      relativeSize: e.relativeSize,
      active,
      delta
    }
  })
  const resolvedPromises = await Promise.all(mapDataToEpics)
  response.json(resolvedPromises.flat())
})



//Get from jira REST API
jiraRouter.get('/projects', async (request, response) => {
  try {
    const projects = await utils.helpers.getAllProjects()
    response.json(projects)
  } catch (error) {
    console.log(error)
    response.status(404).end()
  }
})

// maxResults defaults to 100
jiraRouter.get('/cl', async (request, response) => {
  const issuesWithIdAndMongoId = await Ticket.find({}, { key: 1 })

  const keysOnly = issuesWithIdAndMongoId.map(is => is.key)
  console.log('issues:', keysOnly.length)
  try {
    const updatedResults = await utils.helpers.changeLogsByIdArrayV2(keysOnly)

    response.json({ ...updatedResults })
  } catch (error) {
    console.log(error)
    response.status(404).end()
  }
})



// Get all issues.
jiraRouter.get('/search', async (request, response) => {
  // jql-query for testing
  let jql = 'FILTER=DashBoardTestFilter'
  //let jql = 'ORDER BY Created DESC'
  const startAt = 0
  const maxResults = 100


  try {
    const resArray = await utils.helpers.issueSearchLoopJiraV2(startAt, maxResults, jql)

    // Upsertion
    // Drop collection and insert all?
    await utils.helpers.issuePromises(resArray)
    response.json({ count: resArray.length })

  } catch (error) {
    console.log(error)
  }
})


jiraRouter.get('/:id', async (request, response) => {
  try {
    const issue = await jiraGetIssue(request.params.id)
    response.json({ ...issue })
  } catch (error) {
    console.error(error)
  }
})



const jiraGetIssue = async (issueKey) => {
  const jira = utils.helpers.jiraClientV2()
  const issue = await jira.issues.getChangeLogs({
    issueIdOrKey: issueKey
  })
  return issue
}


module.exports = jiraRouter
