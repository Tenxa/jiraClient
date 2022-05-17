const jiraRouter = require('express').Router()
const utils = require('../utils')
const Ticket = require('../models/ticket')
const Feature = require('../models/feature')
const Epic = require('../models/epic')
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
// We'll probably have to take Takt Times from Todo to Done as in some cases the tickets
// go straight from todo -> done, which is not accurate
// There are many cases where Ticket goes from In progress -> Done in the same day
// so there's no trace of the ticket having inProgress status in the cfd collection.
// In some cases our test data in cfd collection have only To Do statuses because test data is missing some changelogs

// Create a SIP (Stochastic Information Packet) from historical data.
// Thoughts: 
// - Create a SIP packet from all ticket Takt Times (Ticket Delivery time)
//    - Could be created in the initialization phase and added to database.
// - Or find an epic that has similair size and do the simulation to create a SIP
//    - Would have to do 2 simulations every time, one for SIP and one for forecasting.
//    - Has a risk of the 2 epics being similair in size but very different by content and Takt Times.

jiraRouter.get('/epicsTable', async (request, response) => {
  const configuredDate = request.body.configuredDate ? request.body.configuredDate : null

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

jiraRouter.get('/test', async (request, response) => {
  const counts = {
    toDo: 5,
    inProgress: 5,
    done: 15
  }
  console.log(typeof utils.helpers.calculateDelta(counts))
  response.json({ delta: utils.helpers.calculateDelta(counts) })
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
jiraRouter.get('/cl', async (request, response, next) => {
  // test .then .catch they do seem quite useless.
  // Put this inside try-catch
  const idAndMongoId = await Ticket.find({}, { id: 1 })
    .then(result => result)
    .catch(error => console.log(error))

  const idOnly = idAndMongoId.map(is => parseInt(is.id))

  try {
    // true = upsert to db, empty or false = NO DB
    const updatedResults = await utils.helpers.changeLogsByIdArrayV2(idOnly, true)
    response.json({ ...updatedResults })
  } catch (error) {
    console.log(error)
    response.status(404).end()
  }
})


// Upserts to db.
// This we'll use to get all issues.
jiraRouter.post('/search', async (request, response) => {
  let jql = request.body.jql
  const startAt = 0
  const maxResults = 50

  if (!request.body.jql) {
    jql = 'ORDER BY Created DESC'
  }

  try {
    const resArray = await utils.helpers.issueSearchLoopJiraV2(startAt, maxResults, jql)
    response.json({ ...resArray })
    await utils.helpers.issuePromises(resArray)
  } catch (error) {
    console.log('error at api/jira/search', error)
    response.status(404).end()
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


// jiraRouter.post('/', async (request, response, next) => {
//   console.log('Getting all issues with Search');

//   // API dokumentaation mukaan maxResult defaulttina 50.
//   // Kokeiltavana vielä maxResultin nostamista. Ensin pitäisi tehdä lisää testi dataa.
//   let startAt = 0
//   let maxResults = 50
//   let jql = 'ORDER BY Created DESC'

//   try {
//     //const resArray = await utils.issueSearchLoop(startAt, maxResults, jql)
//     const resArray = await utils.helpers.issueSearchLoopJiraV2(startAt, maxResults, jql)
//     await utils.helpers.issuePromises(resArray)
//     response.json({ ...resArray })
//   } catch (error) {
//     console.log('error at api/jira/', error)
//     response.status(404).end()
//   }
// })

const jiraGetIssue = async (issueKey) => {
  const jira = utils.helpers.createJiraClientWithToken()
  const issue = await jira.issue.getIssue({
    issueKey: issueKey
  })
  return issue
}


module.exports = jiraRouter
