const jiraRouter = require('express').Router()
const utils = require('../utils')
const Ticket = require('../models/ticket')
require('express-async-errors')
const nodeCron = require('node-cron')

const schduledDataInitialization = async () => {
  console.log(`data initialization started at: ${new Date().toLocaleString()}`);
  const initialization = await utils.dataInitLoop.dataInitialization
  console.log("Combination objects added:", initialization)
}

const job = nodeCron.schedule('59 59 23 * * *', schduledDataInitialization);

job.start()

// TODO: StatusChanges is not an upsertion, but we'll have to think about is the collection even needed.
jiraRouter.get('/dataInit', async (request, response) => {
  try {
    const dataInit = await utils.dataInitLoop.dataInitialization()
    response.json(dataInit)
  } catch (error) {
    console.log(error)
    response.status(404).end("Error")
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

jiraRouter.get('/epic/cfdByDateRange', async (request, response) => {
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

jiraRouter.get('/feature/cfdByDateRange', async (request, response) => {
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

jiraRouter.get('/epic/cfdByKey/:key', async (request, response) => {
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

jiraRouter.get('/feature/cfdByKey/:key', async (request, response) => {
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


/* 
  Returns feature from db that simulates the fetch from jira (the most recent state)
  And compares to the tickets state at configured date or a year ago.
  Currently we don't have a complete cfd collection, so the active field is not showing 
  its real value.
*/
jiraRouter.get('/feature/table', async (request, response) => {
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


// käytetään tätä ja tehdään keskeneräisille epiceille Monte Carlo simulaatio.
// Aluksi lasketaa delivery time käyttäen dtForEpic.
// Katsotaan todo ja in prog määrä ja tehdään niille monte carlo.
// Tässä vaiheessa emme ota huomioon, kuinka pitkään in prog on ollu työn alla.
jiraRouter.get('/epic/table', async (request, response) => {
  // Onko configuredDate tässä turha? Lisätäänkö mielummin tietokantaan merkkaamaan, milloin datan päivitys on toteutettu?
  // configuredDate selitetty /feature/table funktiossa.
  const configuredDate = request.body.configuredDate ? request.body.configuredDate : null

  const allEpics = await utils.mongooseQueries.getEpicsFromDB()

  const mapDataToEpics = allEpics.map(async (e) => {
    if (!configuredDate) {
      return await utils.mongooseQueries.getEpicByKeyFromDB(e.epic)
    }
    const cfdByDate = await utils.mongooseQueries.cfdEpicByDate(configuredDate, e.epic)
    const active = await utils.helpers.isActive(cfdByDate, e)

    return {
      theme: e.theme,
      epic: e.epic,
      storyStatusesCount: e.storyStatusesCount,
      relativeSize: e.relativeSize,
      active,
      delta: e.delta,
      monteCarlo: e.monteCarlo
    }
  })
  const resolvedPromises = await Promise.all(mapDataToEpics)
  response.json(resolvedPromises.flat())
})


// Material for Monte Carlo Simulation: 
// https://www.slideshare.net/dimiterbak/noestimates-project-planning-using-monte-carlo-simulation
// https://www.youtube.com/watch?v=r38a25ak4co&t=2194s

// Monte Carlo Simulation:
// This will now do a monte carlo for N work items.
// For us to make a forecast on a started Epic we would have to create SIP files for the 3 different phases of Z-Curve
// and do a Monte Carlo simulation for the wanted Z-curve phases.
jiraRouter.get('/monteCarlo/:size', async (request, response) => {
  response.json(await utils.monteCarloSimulation.monteCarloSimulation(request.params.size))
})





// Tässä katsotaan nyt yhden epicin sisälle "CPS-4854"
// Tarkistetaan VALMIIN Epicin todellinen delivery time
// Voidaan käyttää Monte Carlo validointiin tekemällä tämä valmiille epicille ja Monte Carlo saman kokoiselle.
// TODO: muuta sellaiseksi, että voi laittaa keskeneräisen ja katsoo delivery timen vain tehdyille tiketeille.
jiraRouter.get('/epic/deliverytime/:key', async (request, response) => {
  const epicKey = request.params.key
  const result = await utils.epicHelpers.deliveryTimeForDones(epicKey)
  response.json({ result })
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


// Searches and adds to DB
//jiraRouter.get('/search', async (request, response) => {
//  // jql-query for testing
//  let jql = process.env.JQL_FILTER
//  //let jql = 'ORDER BY Created DESC'
//  const startAt = 0
//  const maxResults = 100
//
//  try {
//    const resArray = await utils.helpers.issueSearchLoopJiraV2(startAt, maxResults, jql)
//
//    // Upsertion
//    // Drop collection and insert all?
//    await utils.helpers.issuePromises(resArray)
//    response.json({ count: resArray.length })
//
//  } catch (error) {
//    console.log(error)
//  }
//})


module.exports = jiraRouter
