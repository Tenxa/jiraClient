const jiraRouter = require('express').Router()
const utils = require('../utils/utils')
const mongooseQuery = require('../utils/mongooseQueries')
const storiesWithThemaAndEpic = require('../utils/storiesWithThemaAndEpic')
const Ticket = require('../models/ticket')
require('express-async-errors')


jiraRouter.get('/dataInit', async (request, response) => {
  try {
    // Currently we are getting all tickets that have theme and epic with a mongodb query
    // TODO: get all issues and define themes, business processes, features and epics?
    const themeEpic = await storiesWithThemaAndEpic.storiesWithThemaAndEpic()
    const countCombinations = []
    let combinationObjectList = []
    const today = new Date()
    for (let i = 0; i < themeEpic.length; i++) {
      for (let j = 0; j < themeEpic[i].stories.length; j++) {
        let basicTicket = {
          theme: themeEpic[i].theme,
          epic: null,
          project: themeEpic[i].stories[j].project,
          time: themeEpic[i].stories[j].time,
          issuetype: themeEpic[i].stories[j].issuetype,
          status: 'To Do', //status is to do by default?
          //issueId: themeEpic[i].stories[j].key
        }

        const cl = await mongooseQuery.changelogByIssueId(themeEpic[i].stories[j].key)
        // Create combination object from ticket creation day to today
        if (cl.length === 0) {
          basicTicket.epic = themeEpic[i].epic
          let daysInBetween = utils.getDaysBetweenDates(utils.parseDateyyyymmdd(today), utils.parseDateyyyymmdd(basicTicket.time))
          utils.createCombinationObjects((daysInBetween + 1), basicTicket.time, basicTicket, combinationObjectList)
          continue
        }

        // Loop through changelog items and create combination objects.
        let prevValueDate = null
        for (let v = 0; v < cl[0].values.length; v++) {
          const value = cl[0].values[v]

          for (let z = 0; z < cl[0].values[v].items.length; z++) {
            const item = cl[0].values[v].items[z]
            if (utils.isPertientChange(item.field, basicTicket, item.toString, utils.parseDateyyyymmdd(value.created)) === false) {
              continue
            }

            let daysInBetween = utils.getDaysBetweenDates(utils.parseDateyyyymmdd(value.created), utils.parseDateyyyymmdd(basicTicket.time))
            const prevTime = prevValueDate ? prevValueDate : basicTicket.time

            let ticketTime = new Date(prevTime)

            // pushes combination objects to combinationObjectList[]
            utils.createCombinationObjects((daysInBetween - 1), prevTime, basicTicket, combinationObjectList)
            ticketTime.setDate(ticketTime.getDate() + daysInBetween)

            prevValueDate = value.created
            basicTicket = utils.isPertientChange(item.field, basicTicket, item.toString, ticketTime)

            // Create combination objects from the last cl.value.item to today
            if (v === cl[0].values.length - 1 && z === cl[0].values[v].items.length - 1) {
              daysInBetween = utils.getDaysBetweenDates(utils.parseDateyyyymmdd(today), utils.parseDateyyyymmdd(prevValueDate))
              utils.createCombinationObjects((daysInBetween + 1), prevValueDate, basicTicket, combinationObjectList)
            }
          }
        }
      }
    }

    console.log(combinationObjectList.length)
    // Could do upsertion in the loop above also
    // Loop through combinationObjectList and increment 1 to numberOfIssues if in db
    await utils.cfdUpsert(combinationObjectList)

    // Will response success while db operations are still processing...
    response.json('Success')
  } catch (error) {
    console.log(error)
    response.status(404).end('Error')
  }
})


jiraRouter.get('/issueIdToChangelogs', async (request, response) => {
  try {
    utils.mapLogsWithIssueId()
    //const resolved = await Promise.all(parseIssueIds)
    response.status(200).send('Success')
  } catch (error) {
    console.log(error)
    response.status(404).end('Error')
  }
})

 
// ToDo: Calculate Relative size with standard deviation
// ToDo: Active (Boolean) field
jiraRouter.get('/featureTable', async (request, response) => {
  const businessProcesses = await mongooseQuery.byIssuetypeName('Business Process')

  const featureCollection = businessProcesses.map(async (bp) => {
    const featuresForBp = await mongooseQuery.issuesByParentOrOutwardLinkId(bp.id, 'Feature')

    if (featuresForBp.length === 0) return
    const mapStoriesToFeature = await featuresForBp.map(async (feature) => {
      const storiesForFeature = await mongooseQuery.issuesByParentOrOutwardLinkId(feature.id, 'Story')
      let storyStatusesCount = {
        toDo: 0,
        inProgress: 0,
        done: 0
      }
      const storiesForFeatureBasic = await storiesForFeature.map(story => {
        storyStatusesCount = utils.switchCaseStatus(story.fields.status.statusCategory.name, storyStatusesCount)
        return {
          issueId: story.id,
          key: story.key,
          fields: {
            parent: story.fields.parent,
            issuetype: story.fields.issuetype,
            status: story.fields.status,
            fixVersions: story.fields.fixVersions
          }
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

  const resolveArray = await Promise.all(featureCollection)
  const filterUndefined = await resolveArray.flat().filter(a => a !== undefined)

  response.json(filterUndefined)
})


// 
// To Fix: Theme -> Epic -> Story
jiraRouter.get('/epicsTable', async (request, response) => {
  const themes = await mongooseQuery.byIssuetypeName('Theme')

  const themeEpicStoryMapping = themes.map(async (theme) => {
    const epicsForTheme = await mongooseQuery.issuesByParentOrOutwardLinkId(theme.id, 'Epic')
    if (epicsForTheme.length === 0) return
    const storiesForEpic = epicsForTheme.map(async (epic) => {
      const stories = await mongooseQuery.storiesByParentId(epic.id, 'Story')
      let storyStatusesCount = {
        toDo: 0,
        inProgress: 0,
        done: 0
      }
      stories.forEach(story => storyStatusesCount = utils.switchCaseStatus(story.fields.status.statusCategory.name, storyStatusesCount))
      return {
        epicName: epic.key,
        toWhichTheme: theme.key,
        epicChildrenCount: stories.length,
        storyStatusesCount
      }
    })
    return await Promise.all(storiesForEpic)
  })

  const resolve = await Promise.all(themeEpicStoryMapping)
  const filteredRes = resolve.flat().filter(e => e)
  // To database filteredRes.forEach()
  response.json(filteredRes)
})


jiraRouter.get('/projects', async (request, response) => {
  try {
    const projects = await utils.getAllProjects()
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
    const updatedResults = await utils.changeLogsByIdArrayV2(idOnly, true)
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
    const resArray = await utils.issueSearchLoop(startAt, maxResults, jql)
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
  let maxResults = 10
  let jql = 'ORDER BY Created DESC'

  try {
    //const resArray = await utils.issueSearchLoop(startAt, maxResults, jql)
    const resArray = await utils.issueSearchLoopJiraV2(startAt, maxResults, jql)
    await utils.issuePromises(resArray)
    response.json({ ...resArray })
  } catch (error) {
    console.log('error at api/jira/', error)
    response.status(404).end()
  }
})


const jiraGetIssue = async (issueKey) => {
  const jira = utils.createJiraClientWithToken()
  const issue = await jira.issue.getIssue({
    issueKey: issueKey
  })
  return issue
}


module.exports = jiraRouter
