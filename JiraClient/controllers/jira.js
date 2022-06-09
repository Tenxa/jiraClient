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

// Monte Carlo Simulation notes:
// We'll probably have to take Takt Times from Todo to Done as in some cases the tickets ---- IN progress -> done
// go straight from todo -> done, which is not accurate
// There are many cases where Ticket goes from In progress -> Done in the same day
// so there's no trace of the ticket having inProgress status in the cfd collection.
// In some cases our test data in cfd collection have only To Do statuses because test data is missing some changelogs

// Create a SIP (Stochastic Information Packet) from historical data.
// Thoughts: 
// - Create a SIP packet from all ticket Takt Times (Ticket Delivery time)
//    - Could be created in the initialization phase and added to database.


// NOTES 30.5
// - Get all tickets that are done regardless if the epic is still active.

jiraRouter.get('/createSip', async (request, response) => {
  const sip = []
  // Check Time between in progress -> done OR To Do -> Done but time = 0 in the latter case.
  const epics = await utils.storiesWithThemaAndEpic.storiesWithThemaAndEpic()
  // REMOVE LATER: Slice for testing .slice(0, 20) 
  const epicsWithIssues = epics.filter(epic => epic.stories.length > 0)

  const mapStories = epicsWithIssues.map(async (epic) => {
    const cfdsForEpic = await utils.mongooseQueries.cfdByEpic(epic.epic)
    const inProgressAndDones = cfdsForEpic.filter(cfd => cfd.status === 'In Progress' || cfd.status === 'Done')
    return [...inProgressAndDones]
  })

  const resolveCfds = await Promise.all(mapStories)
  const filterEmpties = resolveCfds.filter(cfds => cfds.length > 0)
  const sortByDate = filterEmpties.map(epic => epic.sort((a, b) => a.time - b.time))


  // inProgchanges is a Map with epic as key and array of changes in numberOfIssues as value. 
  const inProgress = sortByDate.map(epic => epic.filter(cfd => cfd.status === 'In Progress'))
  const inProgChanges = utils.helpers.getStatusIssueChanges(inProgress)

  // Same as above for Dones
  const dones = sortByDate.map(epic => epic.filter(cfd => cfd.status === 'Done'))
  const doneChanges = utils.helpers.getStatusIssueChanges(dones)

  // Loop through in progs and get the next done count. Keep the previous done count in memory to see how many new ones has been done.
  const testInprog = inProgChanges.get('CPS-5248')
  const testDones = doneChanges.get('CPS-5248')

  const doneTickets = []
  //const inProgUniq = []
  const taktTimes = []


  // map all dones. Example result for doneTickets array = [
  //   { numberOfIssues: 2, time: 2022-05-11T21:00:00.000Z },
  //   { numberOfIssues: 2, time: 2022-05-12T21:00:00.000Z },
  //   { numberOfIssues: 1, time: 2022-05-18T21:00:00.000Z }
  // ]
  for (let i = 0; i < testDones.length; i++) {
    if (i === 0) {
      doneTickets.push({ numberOfIssues: testDones[i].numberOfIssues, time: testDones[i].time })
    } else {
      if (testDones[i].numberOfIssues > testDones[i - 1].numberOfIssues) {
        const newDones = testDones[i].numberOfIssues - testDones[i - 1].numberOfIssues
        doneTickets.push({ numberOfIssues: newDones, time: testDones[i].time })
      }
    }
  }

  

  // map doneTickets to same format as inProgUniq for ease of use
  const doneDatesOnly = []
  doneTickets.forEach(d => {
    for (let i = 0; i < d.numberOfIssues; i++) {
      doneDatesOnly.push(d.time)
    }
  })
  console.log(doneDatesOnly)

  // map all new in progress ticket times.
  // Jos done pvm sama kuin in prog.
  // Tehdään vähennyslasku ja katsotaanko onko in prog numberOfIssues sama, jos ei niin lisätään uusi listaan
  const inProgDates = []
  let counter = 0
  for (let i = 0; i < testInprog.length; i++) {
    if (i === 0) {
      for (let j = 0; j < testInprog[0].numberOfIssues; j++) {
        inProgDates.push(testInprog[0].time)
        counter += 1
      }
    } else {
      // jos on tullut lisää in prog tilaan lisätään päivämäärät listaan.
      if (counter < testInprog[i].numberOfIssues) {
        for (let j = 0; j < testInprog[i].numberOfIssues - counter; j++) {
          inProgDates.push(testInprog[i].time)
        }
      }
    }
  }


  // Calculate takt times. first takt times inProg -> dones. Then we will consider that the leftover dones are done on the same day
  // so takt time = 0 for those.
  // for(let i = 0; i < doneDatesOnly.length; i++) {
  //   if (inProgUniq.length > 0) {
  //     const taktTime = utils.helpers.getDaysBetweenDates(doneDatesOnly[i], inProgUniq[0])
  //     taktTimes.push(taktTime)
  //     inProgUniq.shift()
  //   } else {
  //     taktTimes.push(0)
  //   }
  // }
  // console.log(taktTimes)

  //response.json({taktTimes})
  response.json({ testInprog, testDones })
  //response.json({inProgress: Array.from(inProgChanges.entries()), dones: Array.from(doneChanges.entries())})
})



jiraRouter.get('/test', async (request, response) => {
  const statusIssueChanges = await utils.mongooseQueries.getStatusIssueChanges()
  const byEpic = statusIssueChanges.filter(s => s.epic === "CPS-5248" && (s.status === "In Progress" || s.status === "Done"))
  const dones = byEpic.filter(a => a.status === "Done").sort((a, b) => a.time - b.time)
  const inProg = byEpic.filter(a => a.status === "In Progress").sort((a, b) => a.time - b.time)
  response.json({inProg, dones})
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



// This we'll use to get all issues.
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
