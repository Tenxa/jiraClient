const jiraRouter = require('express').Router()
const utils = require('../utils')
const Ticket = require('../models/ticket')
const Feature = require('../models/feature')
require('express-async-errors')



// Nyt haetaan tietokannasta tickets collectionista.
// Myöhemmin, joko tallennetaan kaikki ticketit tietokantaan ja nykyinen toteutus käy hakemassa sieltä,
// Tai haemme jira API:lla dataInit:in alussa.
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


jiraRouter.get('/issueIdToChangelogs', async (request, response) => {
  try {
    utils.helpers.mapLogsWithIssueId()
    //const resolved = await Promise.all(parseIssueIds)
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

  const lastYear = new Date()
  lastYear.setFullYear(lastYear.getFullYear() - 1)

  const featureCollection = await utils.helpers.getAllFeatureData()
  const resolveArray = await Promise.all(featureCollection)
  const filterUndefined = await resolveArray.flat().filter(a => a !== undefined)

  const statusCounts = filterUndefined.map(f => {
    return f.storyStatusesCount.toDo + f.storyStatusesCount.inProgress + f.storyStatusesCount.done
  })
  const standardDeviation = utils.helpers.getStandardDeviation(statusCounts)

  const featurePromises = filterUndefined.map(async (f) => {
    const active = await utils.helpers.activePromise(lastYear, f)
    // Max value to 3?
    const relativeSize = (f.storyStatusesCount.toDo + f.storyStatusesCount.inProgress + f.storyStatusesCount.done) / standardDeviation

    return {
      feature: f.featureName,
      businessProcess: f.toWhichBusinessProcess,
      storyStatusesCount: f.storyStatusesCount,
      relativeSize,
      active
    }
  })
  const insertion = utils.mongooseQueries.insertFeatures(await Promise.all(featurePromises))

  response.json(insertion)
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

  response.json(await Promise.all(mapDataToFeatures))
})


jiraRouter.get('/epicTableByKeyAndStatus', async (request, response) => {
  const epic = await utils.mongooseQueries.cfdByEpic(request.body.key)
  const epicsSortedByDate = epic.sort((a, b) => {
    return new Date(a.time) - new Date(b.time)
  })
  response.json(epicsSortedByDate)
})

// We'll probably have to take Takt Times from Todo to Done as in some cases the tickets
// go straight from todo -> done, which is not accurate
// There are many cases where Ticket goes from In progress -> Done in the same day
// so there's no trace of inProgress status in the cfd collection.

// In some cases our test data in cfd collection have only To Do statuses because test data is missing some changelogs

// To Fix: Theme -> Epic -> Story
jiraRouter.get('/epicsTable', async (request, response) => {
  const themes = await utils.mongooseQueries.byIssuetypeName('Theme')

  const themeEpicStoryMapping = themes.map(async (theme) => {
    const epicsForTheme = await utils.mongooseQueries.issuesByParentOrOutwardLinkId(theme.id, 'Epic')
    if (epicsForTheme.length === 0) return
    const storiesForEpic = epicsForTheme.map(async (epic) => {
      const stories = await utils.mongooseQueries.storiesByParentId(epic.id, 'Story')
      return utils.helpers.countStatuses(stories, epic.key, theme.key, true)
    })
    return await Promise.all(storiesForEpic)
  })

  const resolve = await Promise.all(themeEpicStoryMapping)
  const filteredRes = resolve.flat().filter(e => e)
  // To database => filteredRes.forEach()
  response.json(filteredRes)
})


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
jiraRouter.post('/search', async (request, response) => {
  if (!request.body.jql) {
    return response.send({
      error: 'You must provide a JQL query'
    })
  }
  const jql = request.body.jql
  const startAt = 0
  const maxResults = 10

  try {
    const resArray = await utils.helpers.issueSearchLoop(startAt, maxResults, jql)
    response.json({ ...resArray })
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


jiraRouter.post('/', async (request, response, next) => {
  console.log('Getting all issues with Search');

  // API dokumentaation mukaan maxResult defaulttina 50.
  // Kokeiltavana vielä maxResultin nostamista. Ensin pitäisi tehdä lisää testi dataa.
  let startAt = 0
  let maxResults = 50
  let jql = 'ORDER BY Created DESC'

  try {
    //const resArray = await utils.issueSearchLoop(startAt, maxResults, jql)
    const resArray = await utils.helpers.issueSearchLoopJiraV2(startAt, maxResults, jql)
    await utils.helpers.issuePromises(resArray)
    response.json({ ...resArray })
  } catch (error) {
    console.log('error at api/jira/', error)
    response.status(404).end()
  }
})


const jiraGetIssue = async (issueKey) => {
  const jira = utils.helpers.createJiraClientWithToken()
  const issue = await jira.issue.getIssue({
    issueKey: issueKey
  })
  return issue
}


module.exports = jiraRouter
