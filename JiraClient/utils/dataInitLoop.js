const mongooseQueries = require('./mongooseQueries')
const helpers = require('./helperFunctions')
const storiesWithThemaAndEpic = require('./storiesWithThemaAndEpic')
const StatusChange = require('../models/statusChange')
const Epic = require('../models/epic')
const Feature = require('../models/feature')

const dropAndInsertEpics = async () => {
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

  const themeEpic = await storiesWithThemaAndEpic.storiesWithThemaAndEpic()

  const statusCounts = themeEpic.map(e => {
    return e.storyStatusesCount.toDo + e.storyStatusesCount.inProgress + e.storyStatusesCount.done
  })

  // TODO: If epic is in progress -> Monte Carlo simulation for the remaining items.
  const epicPromises = themeEpic.map(async (e) => {
    const active = await helpers.activePromise(lastYear, true, e)
    const issueSize = e.storyStatusesCount.toDo + e.storyStatusesCount.inProgress + e.storyStatusesCount.done
    const relativeSize = helpers.getRelativeSize(statusCounts, issueSize)
    const delta = await helpers.calculateDelta(e.storyStatusesCount)
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
  await mongooseQueries.insertEpics(resolvedPromises)
  return resolvedPromises
}

const dropAndInsertFeatures = async () => {
  try {
    await Feature.collection.drop()
  } catch (error) {
    if (error.code === 26) {
      console.log('namespace not found')
    } else {
      throw error;
    }
  }

  const featureCollection = await helpers.getAllFeatureData()
  const resolveArray = await Promise.all(featureCollection)
  const filterUndefined = await resolveArray.flat().filter(a => a !== undefined)

  // returns an array for all of the features numberOfIssues
  const statusCounts = filterUndefined.map(f => {
    return f.storyStatusesCount.toDo + f.storyStatusesCount.inProgress + f.storyStatusesCount.done
  })

  const lastYear = new Date()
  lastYear.setFullYear(lastYear.getFullYear() - 1)
  const featurePromises = filterUndefined.map(async (f) => {
    const active = await helpers.activePromise(lastYear, false, f)
    // Max value to 3?
    const issueSize = f.storyStatusesCount.toDo + f.storyStatusesCount.inProgress + f.storyStatusesCount.done
    const relativeSize = helpers.getRelativeSize(statusCounts, issueSize)

    return {
      feature: f.featureName,
      businessProcess: f.toWhichBusinessProcess,
      storyStatusesCount: f.storyStatusesCount,
      relativeSize,
      active
    }
  })
  const resolvedPromises = await Promise.all(featurePromises)
  await mongooseQueries.insertFeatures(resolvedPromises)
}

const dataInitLoop = async (array, epicOrFeature) => {
  const eOrFStoryArrayLength = (i) => {
    return epicOrFeature ? array[i].stories.length : array[i].storiesForFeatureBasic.length
  }
  const eOrFStory = (i, j) => {
    return epicOrFeature ? array[i].stories[j] : array[i].storiesForFeatureBasic[j]
  }

  const combinationObjectList = new Map()
  const statusChanges = []
  const today = new Date()

  for (let i = 0; i < array.length; i++) {
    for (let j = 0; j < eOrFStoryArrayLength(i); j++) {
      if (eOrFStory(i, j) === null || eOrFStory(i, j) === undefined) {
        continue
      }

      let basicTicket = epicOrFeature ?
        {
          issueId: eOrFStory(i, j).key,
          epic: null,
          theme: array[i].theme,
          project: eOrFStory(i, j).project,
          time: eOrFStory(i, j).time,
          issuetype: eOrFStory(i, j).issuetype,
          status: 'To Do', //status is to do by default? until changed from changelogs
        } :
        {
          issueId: eOrFStory(i, j).issueId,
          feature: null,
          businessProcess: array[i].toWhichBusinessProcess,
          project: eOrFStory(i, j).project,
          time: eOrFStory(i, j).time,
          issuetype: eOrFStory(i, j).issuetype,
          status: 'To Do',
        }

      const cl = await mongooseQueries.changelogByIssueId(eOrFStory(i, j).key)

      if (cl.length === 0) {
        if (epicOrFeature) {
          basicTicket.epic = array[i].epic
        } else {
          basicTicket.feature = array[i].featureName
        }
        let daysInBetween = helpers.getDaysBetweenDates(helpers.parseDateyyyymmdd(today), helpers.parseDateyyyymmdd(basicTicket.time))
        helpers.createCombinationObjects((daysInBetween + 1), basicTicket.time, basicTicket, combinationObjectList, epicOrFeature)

        // add initial ticket to statusChange
        statusChanges.push({ ...basicTicket, time: today })
        continue
      }

      let prevValueDate = null
      for (let v = 0; v < cl[0].values.length; v++) {
        const value = cl[0].values[v]

        for (let z = 0; z < cl[0].values[v].items.length; z++) {
          const item = cl[0].values[v].items[z]
          if (epicOrFeature) {
            if (!helpers.isPertientChangeEpic(item.field, basicTicket, item.toString, helpers.parseDateyyyymmdd(value.created))) {
              continue
            }
          } else {
            if (!helpers.isPertientChangeFeature(item.field, basicTicket, item.toString, helpers.parseDateyyyymmdd(value.created))) {
              continue
            }
          }

          // add to statusChanges if status changed. time = value.created
          if (item.field === "status") {
            statusChanges.push({ ...basicTicket, time: value.created, status: item.toString })
          }

          let daysInBetween = helpers.getDaysBetweenDates(helpers.parseDateyyyymmdd(value.created), helpers.parseDateyyyymmdd(basicTicket.time))
          const prevTime = prevValueDate ? prevValueDate : basicTicket.time

          let ticketTime = new Date(prevTime)

          helpers.createCombinationObjects((daysInBetween), prevTime, basicTicket, combinationObjectList, epicOrFeature)
          ticketTime.setDate(ticketTime.getDate() + daysInBetween)

          prevValueDate = value.created
          if (epicOrFeature) {
            basicTicket = helpers.isPertientChangeEpic(item.field, basicTicket, item.toString, ticketTime)
          } else {
            basicTicket = helpers.isPertientChangeFeature(item.field, basicTicket, item.toString, ticketTime)
          }

          if (v === cl[0].values.length - 1 && z === cl[0].values[v].items.length - 1) {
            daysInBetween = helpers.getDaysBetweenDates(helpers.parseDateyyyymmdd(today), helpers.parseDateyyyymmdd(prevValueDate))
            helpers.createCombinationObjects((daysInBetween + 1), prevValueDate, basicTicket, combinationObjectList, epicOrFeature)
          }
        }
      }
    }
  }

  try {
    await StatusChange.collection.drop()
  } catch (error) {
    if (error.code === 26) {
      console.log('namespace not found')
    } else {
      throw error;
    }
  }
  await mongooseQueries.insertStatusChanges(statusChanges)

  const result = Array.from(combinationObjectList.entries()).map(value => value[1]).flat()
  return result
}

module.exports = {
  dataInitLoop,
  dropAndInsertEpics,
  dropAndInsertFeatures
}